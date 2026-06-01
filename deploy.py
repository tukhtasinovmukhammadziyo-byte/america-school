import os
import subprocess
import sys

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, check=True, text=True, capture_output=True)
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr

def main():
    print("============================================")
    print("      AMERICAN SCHOOL GITHUB DEPLOYER")
    print("============================================\n")

    # Check if git is initialized
    if not os.path.exists(".git"):
        print("[+] Git ishga tushirilmoqda...")
        run_cmd("git init")

    # Check remote origin
    success, output = run_cmd("git remote -v")
    if "origin" not in output:
        repo_url = input("[!] GitHub linkini kiriting: ").strip()
        if not repo_url:
            print("Xato: Link bo'sh bo'lmasligi kerak!")
            return
        run_cmd(f"git remote add origin {repo_url}")
        run_cmd("git branch -M main")

    print("[+] Fayllar yuklashga tayyorlanmoqda...")
    run_cmd("git add .")
    
    commit_msg = f"Update: {subprocess.check_output(['date', '/t'], shell=True).decode().strip()} {subprocess.check_output(['time', '/t'], shell=True).decode().strip()}"
    run_cmd(f'git commit -m "{commit_msg}"')

    print("[+] GitHub'ga yuborilmoqda... (Iltimos kuting)")
    success, error = run_cmd("git push -u origin main")

    if success:
        print("\n============================================")
        print("    MUVAFFARIYATLI YUKLANDI! (OK)")
        print("============================================")
    else:
        print("\n[!] XATOLIK YUZ BERDI:")
        print(error)
        
        choice = input("\nLinkni o'zgartirib qaytadan urinib ko'ramizmi? (y/n): ").lower()
        if choice == 'y':
            run_cmd("git remote remove origin")
            main()

if __name__ == "__main__":
    main()
    input("\nYopish uchun Enter ni bosing...")
