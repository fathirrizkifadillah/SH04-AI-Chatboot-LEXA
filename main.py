import sys
from llm import LexaChatbot

def main():
    print("=== Memulai Chatbot Customer Service Lexa ===")
    try:
        # Inisialisasi chatbot
        bot = LexaChatbot()
        print("Lexa aktif! Ketik 'keluar' atau 'exit' untuk menyudahi obrolan.\n")
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    while True:
        try:
            user_input = input("Pelanggan: ")
            if user_input.strip().lower() in ['keluar', 'exit']:
                print("Lexa: Terima kasih telah menghubungi kami. Semoga hari Anda menyenangkan!")
                break
                
            if not user_input.strip():
                continue

            print("Lexa: ", end="", flush=True)
            # Menggunakan mode stream agar respon terasa lebih hidup dan instan
            for chunk in bot.send_message_stream(user_input):
                print(chunk, end="", flush=True)
            print("\n")
            
        except KeyboardInterrupt:
            print("\nLexa: Obrolan dihentikan secara paksa. Sampai jumpa!")
            break
        except Exception as e:
            print(f"\nTerjadi kesalahan: {e}\n")

if __name__ == "__main__":
    main()
