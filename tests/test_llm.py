"""
Tests untuk core/llm.py
Cakupan: retry logic, history rollback on error, backoff, message formatting
"""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["GROQ_API_KEY"] = "mock-groq-key"

from core.llm import LexaChatbot
from core.database import init_database


@pytest.fixture(autouse=True)
def setup_db():
    init_database()


class TestLLMRetry:
    @pytest.mark.anyio
    async def test_send_message_retries_on_transient_failure_then_succeeds(self):
        bot = LexaChatbot(session_id="test_retry_success")

        # Mock completion response
        mock_choice = MagicMock()
        mock_choice.message.content = "Jawaban berhasil setelah retry"
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]

        # Fail on attempt 1, succeed on attempt 2
        mock_create = AsyncMock(side_effect=[
            ConnectionError("Temporary network reset"),
            mock_resp,
        ])
        bot.client.chat.completions.create = mock_create

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            reply = await bot.send_message("Halo bot")

        assert reply == "Jawaban berhasil setelah retry"
        assert mock_create.call_count == 2
        mock_sleep.assert_awaited_once()

    @pytest.mark.anyio
    async def test_send_message_exhausts_retries_and_rolls_back_history(self):
        bot = LexaChatbot(session_id="test_retry_exhaust")

        # Always fail with transient error
        mock_create = AsyncMock(side_effect=Exception("Rate limit 429"))
        bot.client.chat.completions.create = mock_create

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError) as exc_info:
                await bot.send_message("Halo bot")

        assert "Gagal memproses request ke Groq API" in str(exc_info.value)
        assert mock_create.call_count == 3
        # History harus bersih (pesan user di-rollback)
        assert not any(m.get("content") == "Halo bot" for m in bot.history)

    @pytest.mark.anyio
    async def test_send_message_aborts_immediately_on_invalid_api_key(self):
        bot = LexaChatbot(session_id="test_retry_invalid_key")

        mock_create = AsyncMock(side_effect=Exception("invalid_api_key provided"))
        bot.client.chat.completions.create = mock_create

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            with pytest.raises(RuntimeError):
                await bot.send_message("Halo bot")

        # Tidak boleh buang-buang waktu retry jika key invalid
        assert mock_create.call_count == 1
        mock_sleep.assert_not_called()
