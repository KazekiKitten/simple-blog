import os
import re
import subprocess
from datetime import datetime
import markdown
from bs4 import BeautifulSoup

def show_markdown_help():
    help_text = """
Markdown Syntax Quick Reference:
================================
# Heading 1          ## Heading 2         ### Heading 3
**bold text**         *italic text*        ***bold italic***
[link text](URL)      ![alt text](image.jpg)
`inline code`         
```python
code block
```
> Blockquote          - List item          1. Numbered list
| Table | Header |    --- (horizontal rule)
|-------|--------|
| Cell  | Data   |
================================
"""
    print(help_text)

def get_multiline_input_with_suggestions():
    print("\n" + "="*60)
    print("MARKDOWN CONTENT INPUT")
    print("="*60)
    print("Tips:")
    print("   - Start with a brief introduction paragraph")
    print("   - Use headings (##, ###) to organize content")
    print("   - Add code blocks with ```language for syntax highlighting")
    print("   - Include links and images to make it engaging")
    print("   - End with a conclusion or call-to-action")
    print("\nType 'help' on a new line to see Markdown syntax")
    print("Finish input: Ctrl+D (Linux/Mac) or Ctrl+Z+Enter (Windows)")
    print("="*60)
    print("Enter your post content below:\n")
    
    content_lines = []
    try:
        while True:
            try:
                line = input()
                if line.strip().lower() == 'help':
                    show_markdown_help()
                    continue
                content_lines.append(line)
            except KeyboardInterrupt:
                print("\n\nInput cancelled by user")
                return None
    except EOFError:
        pass
    
    content = '\n'.join(content_lines).strip()
    
    if content:
        print(f"\nContent Preview ({len(content)} characters):")
        print("-" * 50)
        preview = content[:200] + "..." if len(content) > 200 else content
        print(preview)
        print("-" * 50)
        
        suggestions = []
        if not re.search(r'^#+\s', content, re.MULTILINE):
            suggestions.append("Consider adding headings with # or ## for better structure")
        if len(content) < 100:
            suggestions.append("Content seems short - consider expanding with more details")
        if not re.search(r'\[.*\]\(.*\)', content):
            suggestions.append("Consider adding links to make content more engaging")
        
        if suggestions:
            print("\nContent Suggestions:")
            for i, suggestion in enumerate(suggestions, 1):
                print(f"   {i}. {suggestion}")
        
        confirm = input(f"\nUse this content? (y/n/e to edit): ").lower()
        if confirm == 'e':
            print("\nRe-entering content mode...\n")
            return get_multiline_input_with_suggestions()
        elif confirm != 'y':
            return None
    
    return content

def create_new_post():
    print("Welcome to Cat-logs Post Creator!")
    print("-" * 40)
    
    title = input("Enter post title: ").strip()
    if not title:
        print("Title cannot be empty.")
        return
    
    content = get_multiline_input_with_suggestions()
    if not content:
        print("Content cannot be empty or was cancelled.")
        return
    
    slug = re.sub(r'[^a-zA-Z0-9]', '-', title.lower())
    slug = re.sub(r'-+', '-', slug).strip('-')
    filename = f"{slug}.html"
    
    if os.path.exists(filename):
        overwrite = input(f"File {filename} already exists. Overwrite? (y/n): ").lower()
        if overwrite != 'y':
            print("Aborted.")
            return
    
    print("\nProcessing your post...")
    
    html_content = markdown.markdown(
        content,
        extensions=["fenced_code", "tables", "codehilite", "toc", "extra"]
    )
    
    post_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Cat-logs</title>
    <link rel="stylesheet" href="style.css">
    <meta name="description" content="{title} - A Cat-logs blog post">
</head>
<body>
    <header>
        <h1><a href="index.html">Cat-logs</a></h1>
        <nav>
            <a href="index.html">Home</a>
        </nav>
    </header>
    <main>
        <article>
            <header>
                <h1>{title}</h1>
                <p class="post-meta">Published on {datetime.now().strftime('%B %d, %Y')}</p>
            </header>
            <div class="post-content">
                {html_content}
            </div>
        </article>
        <footer>
            <p><a href="index.html">← Back to all posts</a></p>
        </footer>
    </main>
    <script src="script.js"></script>
</body>
</html>"""
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(post_html)
        print(f"Created {filename}")
    except Exception as e:
        print(f"Error creating file: {e}")
        return
    
    soup = BeautifulSoup(html_content, "html.parser")
    text_summary = soup.get_text()
    summary = text_summary[:150] + "..." if len(text_summary) > 150 else text_summary
    
    link_html = f"""        <article class="post-preview">
            <h2><a href="{filename}">{title}</a></h2>
            <p class="post-summary">{summary}</p>
            <p class="post-date">{datetime.now().strftime('%B %d, %Y')}</p>
        </article>"""
    
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
    except Exception as e:
        print(f"Error updating index: {e}")
    
    git_push = input("\nPush to GitHub? (y/n): ").lower()
    if git_push == 'y':
        try:
            print("Pushing to GitHub...")
            subprocess.run(['git', 'add', '.'], check=True)
            subprocess.run(['git', 'commit', '-m', f'Add new post: {title}'], check=True)
            
            result = subprocess.run(
                ['git', 'branch', '--show-current'],
                capture_output=True, text=True, check=True
            )
            branch = result.stdout.strip()
            subprocess.run(['git', 'push', '--set-upstream', 'origin', branch], check=True)
            print("Successfully pushed changes to GitHub")
            
        except subprocess.CalledProcessError as e:
            print(f"Git command failed: {e}")
        except FileNotFoundError:
            print("Git not found. Please ensure Git is installed and the repository is initialized.")
    
    print(f"\nPost '{title}' has been created successfully!")
    print(f"File: {filename}")
    print("Your blog is ready to view!")

if __name__ == "__main__":
    create_new_post()