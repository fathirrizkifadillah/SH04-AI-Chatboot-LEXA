"""
Lexa Chatbot - Orphaned Chroma Directory Cleanup
================================================
Purges abandoned staging folders ('knowledge_base/lexa_chroma_*')
left behind by previous uncollected reindex runs.
"""

import os
import shutil
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def get_dir_size(path: str) -> int:
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total_size += os.path.getsize(fp)
            except OSError:
                pass
    return total_size


def cleanup_orphans():
    print("=" * 60)
    print("PEMBERSIHAN DIREKTORI ORPHAN LEAKS CHROMA")
    print("=" * 60)

    kb_dir = "knowledge_base"
    if not os.path.exists(kb_dir):
        print(f"Direktori '{kb_dir}' tidak ditemukan. Lewati.")
        return

    orphan_dirs = [
        d for d in os.listdir(kb_dir)
        if d.startswith("lexa_chroma_") and os.path.isdir(os.path.join(kb_dir, d))
    ]

    if not orphan_dirs:
        print("[+] Tidak ada folder lexa_chroma_* yang tercecer. Disk bersih!")
        return

    print(f"[*] Ditemukan {len(orphan_dirs)} folder lexa_chroma_* yang tercecer:")
    total_reclaimed = 0

    for d in orphan_dirs:
        full_path = os.path.join(kb_dir, d)
        size = get_dir_size(full_path)
        total_reclaimed += size
        try:
            shutil.rmtree(full_path, ignore_errors=True)
            print(f"  [x] Dihapus: {d} ({size / (1024 * 1024):.2f} MB)")
        except Exception as e:
            print(f"  [!] Gagal menghapus {d}: {e}")

    print("\n" + "=" * 60)
    print(f"[+] SELESAI: Berhasil membersihkan {len(orphan_dirs)} direktori.")
    print(f"[+] Total ruang disk yang dibebaskan: {total_reclaimed / (1024 * 1024):.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    cleanup_orphans()
