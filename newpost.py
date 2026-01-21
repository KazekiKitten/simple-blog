import os
import re
import subprocess
from datetime import datetime
import markdown
from bs4 import BeautifulSoup
import sys

# Try to import readline for better line editing (cross-platform)
try:
    import readline
except ImportError:
    pass  # readline not available on Windows, but still works


def get_input_with_editing(prompt):
    """Get input with better arrow key support."""
    try:
        return input(prompt)
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(0)


def create_new_post():
    title = get_input_with_editing("Enter post title: ").strip()
    if not title:
        print("Title cannot be empty.")
        return

    category = get_input_with_editing("Enter post category: ").strip()
    if not category:
        print("Category cannot be empty.")
        return

    print("Enter post content in Markdown (press Ctrl+D on Linux/Mac or Ctrl+Z on Windows to finish):")
    print("(You can now use arrow keys, backspace, and other editing keys)")

    content_lines = []
    try:
        while True:
            line = get_input_with_editing("")
            content_lines.append(line)
    except EOFError:
        pass

    content = '\n'.join(content_lines).strip()

    if not content:
        print("Content cannot be empty.")
        return

    slug = re.sub(r'[^a-zA-Z0-9]', '-', title.lower())
    slug = re.sub(r'-+', '-', slug).strip('-')
    filename = f"{slug}.html"

    # Check if file exists
    if os.path.exists(filename):
        overwrite = get_input_with_editing(f"File {filename} already exists. Overwrite? (y/n): ").lower()
        if overwrite != 'y':
            print("Aborted.")
            return

    # Convert Markdown to HTML
    html_content = markdown.markdown(
        content,
        extensions=["fenced_code", "tables", "codehilite"]
    )

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
            {html_content}
        </article>
    </main>
    <script src="script.js"></script>
</body>
 <footer>
            <p><a href="index.html">← Back to all posts</a></p>
        </footer>
</html>"""

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(post_html)
    print(f"Created {filename}")

    # Generate summary (plain text, no Markdown/HTML)
    soup = BeautifulSoup(html_content, "html.parser")
    text_summary = soup.get_text()
    summary = text_summary[:100] + "..." if len(text_summary) > 100 else text_summary

    # Generate timestamp
    timestamp = datetime.now().isoformat() + 'Z'

    # Generate link HTML for index
    link_html = f"""        <article data-category="{category.lower()}" data-timestamp="{timestamp}">
            <span class="category">{category}</span>
            <h2><a href="{filename}">{title}</a></h2>
            <p>{summary}</p>
        </article>"""

    # Update index.html
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            index_content = f.read()

        main_pattern = r'(<main>.*?)(\s*</main>)'
        match = re.search(main_pattern, index_content, re.DOTALL)
        if match:
            new_main = match.group(1) + '\n' + link_html + '\n' + match.group(2)
            new_index = index_content.replace(match.group(0), new_main)
            with open('index.html', 'w', encoding='utf-8') as f:
                f.write(new_index)
            print("Updated index.html with new post link")
        else:
            print("Could not find <main> section in index.html")
    except FileNotFoundError:
        print("index.html not found. Skipping index update.")

    # Push to GitHub
    try:
        subprocess.run(['git', 'add', '.'], check=True)
        subprocess.run(['git', 'commit', '-m', f'Add new post: {title}'], check=True)
        # Get current branch
        result = subprocess.run(
            ['git', 'branch', '--show-current'],
            capture_output=True, text=True, check=True
        )
        branch = result.stdout.strip()
        subprocess.run(['git', 'push', '--set-upstream', 'origin', branch], check=True)
        print("Pushed changes to GitHub")
    except subprocess.CalledProcessError as e:
        print(f"Git command failed: {e}")
    except FileNotFoundError:
        print("Git not found. Please ensure Git is installed and the repository is initialized.")


if __name__ == "__main__":
    create_new_post()
