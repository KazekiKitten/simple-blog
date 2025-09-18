
import os
import re
import subprocess
from datetime import datetime

def create_new_post():
    title = input("Enter post title: ").strip()
    if not title:
        print("Title cannot be empty.")
        return

    print("Enter post content (press Ctrl+D or Ctrl+Z to finish):")
    content_lines = []
    try:
        while True:
            line = input()
            content_lines.append(line)
    except EOFError:
        passMy Simple Blog
    content = '\n'.join(content_lines).strip()

    if not content:
        print("Content cannot be empty.")
        return

    slug = re.sub(r'[^a-zA-Z0-9]', '-', title.lower())
    slug = re.sub(r'-+', '-', slug).strip('-')
    filename = f"{slug}.html"

    # Check if file exists
    if os.path.exists(filename):
        overwrite = input(f"File {filename} already exists. Overwrite? (y/n): ").lower()
        if overwrite != 'y':
            print("Aborted.")
            return

    post_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Cat-logs</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1><a href="index.html">Cat-logs</a></h1>
    </header>
    <main>
        <article>
            <h2>{title}</h2>
            <p>Published on {datetime.now().strftime('%B %d, %Y')}</p>
            <p>{content.replace('\n', '</p>\n            <p>')}</p>
        </article>
    </main>
</body>
</html>"""

    with open(filename, 'w') as f:
        f.write(post_html)
    print(f"Created {filename}")

    # Generate link HTML
    summary = content[:100] + "..." if len(content) > 100 else content
    link_html = f"""        <article>
            <h2><a href="{filename}">{title}</a></h2>
            <p>{summary}</p>
        </article>"""
    with open('index.html', 'r') as f:
        index_content = f.read()

    main_pattern = r'(<main>.*?)(\s*</main>)'
    match = re.search(main_pattern, index_content, re.DOTALL)
    if match:
        new_main = match.group(1) + '\n' + link_html + '\n' + match.group(2)
        new_index = index_content.replace(match.group(0), new_main)
        with open('index.html', 'w') as f:
            f.write(new_index)
        print("Updated index.html with new post link")
    else:
        print("Could not find main section in index.html")

    # Push to GitHub
    try:
        subprocess.run(['git', 'add', '.'], check=True)
        subprocess.run(['git', 'commit', '-m', f'Add new post: {title}'], check=True)
        # Get current branch
        result = subprocess.run(['git', 'branch', '--show-current'], capture_output=True, text=True, check=True)
        branch = result.stdout.strip()
        subprocess.run(['git', 'push', '--set-upstream', 'origin', branch], check=True)
        print("Pushed changes to GitHub")
    except subprocess.CalledProcessError as e:
        print(f"Git command failed: {e}")
    except FileNotFoundError:
        print("Git not found. Please ensure Git is installed and the repository is initialized.")

if __name__ == "__main__":
    create_new_post()