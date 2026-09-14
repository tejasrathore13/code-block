// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const snippetsGrid = document.getElementById('snippets-grid');
const searchInput = document.getElementById('search');
const addSnippetBtn = document.getElementById('add-snippet');
const addSnippetSidebarBtn = document.getElementById('add-snippet-sidebar');
const themeToggle = document.getElementById('theme-toggle');
const modalOverlay = document.getElementById('snippet-modal-overlay');
const closeModalBtn = document.getElementById('close-modal');
const cancelSnippetBtn = document.getElementById('cancel-snippet');
const saveSnippetBtn = document.getElementById('save-snippet');
const snippetForm = document.getElementById('snippet-form');
const modalTitle = document.getElementById('modal-title');
const snippetIdInput = document.getElementById('snippet-id');
const titleInput = document.getElementById('title');
const categoryInput = document.getElementById('category');
const codeInput = document.getElementById('code');
const categoryList = document.getElementById('category-list');
const contentArea = document.getElementById('main-content');

// State
let snippets = [];
let snippetOrder = [];
let editMode = false;
let activeCategory = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSnippets();
  renderSnippets();
  loadTheme();
  updateCategoryList();
});

// Event Listeners
searchInput.addEventListener('input', renderSnippets);
addSnippetBtn.addEventListener('click', openAddSnippetModal);
addSnippetSidebarBtn.addEventListener('click', openAddSnippetModal);
themeToggle.addEventListener('click', toggleTheme);
closeModalBtn.addEventListener('click', closeModal);
cancelSnippetBtn.addEventListener('click', closeModal);
saveSnippetBtn.addEventListener('click', saveSnippet);
toggleSidebarBtn.addEventListener('click', toggleSidebar);
document.addEventListener('keydown', handleSearchShortcut);

// Functions
// Ctrl + / (Cmd + / on Mac) focuses the search bar from anywhere on the page
function handleSearchShortcut(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key !== '/') return;

  // Don't steal focus while a modal (editor or preview) is covering the search bar
  if (document.querySelector('.modal-overlay.active')) return;

  e.preventDefault();
  searchInput.focus();
  // Keep any existing query and place the caret at the end of it
  const end = searchInput.value.length;
  searchInput.setSelectionRange(end, end);
}

function loadSnippets() {
  const storedSnippets = localStorage.getItem('codeSnippets');
  const storedOrder = localStorage.getItem('snippetOrder');
  snippets = storedSnippets ? JSON.parse(storedSnippets) : [];
  snippetOrder = storedOrder ? JSON.parse(storedOrder) : snippets.map(s => s.id);
}

function saveSnippetsToStorage() {
  localStorage.setItem('codeSnippets', JSON.stringify(snippets));
  localStorage.setItem('snippetOrder', JSON.stringify(snippetOrder));
}

function renderSnippets() {
  const searchTerm = searchInput.value.toLowerCase();
  let filteredSnippets = snippets;

  if (searchTerm) {
    filteredSnippets = filteredSnippets.filter(snippet => 
      snippet.title.toLowerCase().includes(searchTerm) || 
      snippet.category.toLowerCase().includes(searchTerm)
    );
  }

  if (activeCategory !== 'all') {
    filteredSnippets = filteredSnippets.filter(snippet => 
      snippet.category === activeCategory
    );
  }

  // Order by user-defined order, then pinned
  filteredSnippets.sort((a, b) => {
    // Pinned first
    if (b.pinned !== a.pinned) return b.pinned - a.pinned;
    // Manual order
    return snippetOrder.indexOf(a.id) - snippetOrder.indexOf(b.id);
  });

  snippetsGrid.innerHTML = '';

  if (filteredSnippets.length === 0) {
    snippetsGrid.innerHTML = `
      <div class="empty-state">
        <h2>No snippets found</h2>
        <p>Add your first code snippet or try a different search term.</p>
      </div>
    `;
    return;
  }

  filteredSnippets.forEach(snippet => {
    const snippetCard = document.createElement('div');
    snippetCard.className = 'snippet-card';
    snippetCard.setAttribute('draggable', 'true');
    snippetCard.setAttribute('data-id', snippet.id);

    snippetCard.innerHTML = `
    <div class="snippet-header">
      <div class="snippet-title">${snippet.title}</div>
      <div class="snippet-category">${snippet.category}</div>
      <button class="pin-btn ${snippet.pinned ? 'pinned' : ''}" onclick="togglePin('${snippet.id}')">
        <i class="fas fa-thumbtack"></i>
      </button>
    </div>
    <div class="snippet-content">
      <pre><code class="language-${snippet.category.toLowerCase()}">${escapeHtml(snippet.code)}</code></pre>
    </div>
    <div class="snippet-actions">
      <button class="secondary-btn copy-btn" onclick="copyToClipboard('${snippet.id}')">
        <i class="fas fa-copy"></i> Copy
      </button>
      <button class="secondary-btn" onclick="editSnippet('${snippet.id}')">
        <i class="fas fa-edit"></i> Edit
      </button>
      <button class="secondary-btn" onclick="deleteSnippet('${snippet.id}')">
        <i class="fas fa-trash"></i> Delete
      </button>
      <button class="secondary-btn gist-btn" onclick="shareToGist('${snippet.id}')">
        <i class="fab fa-github"></i> Share to Gist
      </button>
    </div>
  `;

    // Drag events
    snippetCard.addEventListener('dragstart', handleDragStart);
    snippetCard.addEventListener('dragover', handleDragOver);
    snippetCard.addEventListener('drop', handleDrop);
    snippetCard.addEventListener('dragend', handleDragEnd);

    snippetsGrid.appendChild(snippetCard);

    // Highlight the code block
    const codeBlock = snippetCard.querySelector('pre code');
    hljs.highlightElement(codeBlock);
  });
}

// Drag and drop handlers
let draggedId = null;
function handleDragStart(e) {
  draggedId = this.getAttribute('data-id');
  this.classList.add('dragging');
}
function handleDragOver(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const droppedId = this.getAttribute('data-id');
  if (draggedId && droppedId && draggedId !== droppedId) {
    const fromIdx = snippetOrder.indexOf(draggedId);
    const toIdx = snippetOrder.indexOf(droppedId);
    snippetOrder.splice(fromIdx, 1);
    snippetOrder.splice(toIdx, 0, draggedId);
    saveSnippetsToStorage();
    renderSnippets();
  }
  draggedId = null;
}
function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.snippet-card.drag-over').forEach(card => card.classList.remove('drag-over'));
}

function updateCategoryList() {
  // Get unique categories
  const categories = [...new Set(snippets.map(snippet => snippet.category))];
  
  // Clear existing categories except "All Snippets"
  const allCategoriesItem = categoryList.querySelector('[data-category="all"]');
  categoryList.innerHTML = '';
  categoryList.appendChild(allCategoriesItem);
  
  // Add categories to the list
  categories.forEach(category => {
    if (category) {
      const li = document.createElement('li');
      li.textContent = category;
      li.setAttribute('data-category', category);
      if (activeCategory === category) {
        li.classList.add('active');
      }
      li.addEventListener('click', () => {
        setActiveCategory(category);
      });
      categoryList.appendChild(li);
    }
  });
  
  // Add event listener to "All Snippets"
  allCategoriesItem.addEventListener('click', () => {
    setActiveCategory('all');
  });
}

function setActiveCategory(category) {
  activeCategory = category;
  
  // Update active class
  document.querySelectorAll('.category-list li').forEach(item => {
    if (item.getAttribute('data-category') === category) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  renderSnippets();
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openAddSnippetModal() {
  editMode = false;
  modalTitle.textContent = 'Add New Snippet';
  snippetForm.reset();
  snippetIdInput.value = '';
  modalOverlay.classList.add('active');
}

function editSnippet(id) {
  editMode = true;
  modalTitle.textContent = 'Edit Snippet';
  
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    snippetIdInput.value = snippet.id;
    titleInput.value = snippet.title;
    categoryInput.value = snippet.category;
    codeInput.value = snippet.code;
    modalOverlay.classList.add('active');
  }
}

function deleteSnippet(id) {
  if (confirm('Are you sure you want to delete this snippet?')) {
    snippets = snippets.filter(snippet => snippet.id !== id);
    snippetOrder = snippetOrder.filter(sid => sid !== id);
    saveSnippetsToStorage();
    renderSnippets();
    updateCategoryList();
  }
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

function saveSnippet() {
  if (!snippetForm.checkValidity()) {
    snippetForm.reportValidity();
    return;
  }

  const title = titleInput.value;
  const category = categoryInput.value;
  const code = codeInput.value;

  if (editMode) {
    const id = snippetIdInput.value;
    const index = snippets.findIndex(s => s.id === id);
    if (index !== -1) {
      snippets[index] = { 
        id, 
        title, 
        category, 
        code, 
        pinned: snippets[index].pinned // Preserve pinned status 
      };
    }
  } else {
    const id = Date.now().toString();
    snippets.push({ id, title, category, code, pinned: false }); // Default pinned: false
    snippetOrder.push(id);
  }

  saveSnippetsToStorage();
  renderSnippets();
  updateCategoryList();
  closeModal();
}

function loadTheme() {
  const darkMode = localStorage.getItem('darkMode') === 'true';
  if (darkMode) {
    document.body.classList.add('dark-mode');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function toggleSidebar() {
  sidebar.classList.toggle('active');
  
  if (sidebar.classList.contains("active")) {
    toggleSidebarBtn.style.transform = "translateX(180px)";
    contentArea.style.marginLeft = "250px";
  } else {
    toggleSidebarBtn.style.transform = "translateX(0)";
    contentArea.style.marginLeft = "0px";
  }
}
function togglePin(id) {
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    snippet.pinned = !snippet.pinned;
    saveSnippetsToStorage();
    renderSnippets();
  }
}

function copyToClipboard(id) {
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    navigator.clipboard.writeText(snippet.code)
      .then(() => {
        // Optional: Show feedback to user
        const button = document.querySelector(`.snippet-card button[onclick="copyToClipboard('${id}')"]`);
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.disabled = true;
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.disabled = false;
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy code to clipboard');
      });
  }
}

// Make functions available globally for onclick handlers
window.editSnippet = editSnippet;
window.deleteSnippet = deleteSnippet; 
window.copyToClipboard = copyToClipboard;

const previewModal = document.getElementById('preview-modal-overlay');
const previewCode = document.getElementById('preview-code');
const closePreviewBtn = document.getElementById('close-preview-modal');

function openPreview(code) {
  previewCode.textContent = code;
  // highlight.js skips elements it has already highlighted
  delete previewCode.dataset.highlighted;
  hljs.highlightElement(previewCode);
  previewModal.classList.add('active');
}

closePreviewBtn.addEventListener('click', () => {
  previewModal.classList.remove('active');
});

document.getElementById('snippets-grid').addEventListener('click', (e) => {
  const snippetCard = e.target.closest('.snippet-card');
  // Card buttons (pin, copy, edit, delete) have their own actions
  if (!snippetCard || e.target.closest('button')) return;
  const code = snippetCard.querySelector('pre') ? snippetCard.querySelector('pre').textContent : '';
  if(code) openPreview(code);
});

function getGithubToken() {
  let token = localStorage.getItem('githubPat');
  if (!token) {
    token = prompt(
      'Enter a GitHub Personal Access Token (needs only the "gist" scope).\n' +
      'Create one at https://github.com/settings/tokens'
    );
    if (token) {
      localStorage.setItem('githubPat', token.trim());
      token = token.trim();
    }
  }
  return token;
}

async function shareToGist(id) {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  const token = getGithubToken();
  if (!token) return;

  const button = document.querySelector(`.snippet-card[data-id="${id}"] .gist-btn`);
  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sharing...';

  const filename = `${snippet.title.replace(/[^a-z0-9._-]/gi, '_') || 'snippet'}.${extensionFor(snippet.category)}`;

  try {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: snippet.title,
        public: false,
        files: {
          [filename]: { content: snippet.code }
        }
      })
    });

    if (response.status === 401) {
      localStorage.removeItem('githubPat');
      throw new Error('GitHub rejected the token (401). Please try again with a valid PAT.');
    }
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub API error (${response.status})`);
    }

    const data = await response.json();
    button.innerHTML = '<i class="fas fa-check"></i> Gist Created!';
    window.open(data.html_url, '_blank', 'noopener,noreferrer');

    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.disabled = false;
    }, 3000);

  } catch (err) {
    console.error('Failed to create gist:', err);
    alert(`Failed to create Gist: ${err.message}`);
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
}

function extensionFor(category) {
  const map = {
    javascript: 'js', js: 'js', python: 'py', java: 'java',
    html: 'html', css: 'css', json: 'json', cpp: 'cpp', c: 'c',
    typescript: 'ts', ts: 'ts', bash: 'sh', shell: 'sh', ruby: 'rb',
    go: 'go', php: 'php', sql: 'sql'
  };
  return map[category?.toLowerCase()] || 'txt';
}

window.shareToGist = shareToGist;