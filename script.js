// API URL
const API_URL = 'https://api.escuelajs.co/api/v1/products';

// DOM Elements
const productTableBody = document.getElementById('productTableBody');
const loadingElement = document.getElementById('loading');

// Biến lưu trữ danh sách sản phẩm gốc
let allProducts = [];

// Biến lưu trữ danh sách sau khi lọc (search)
let filteredProducts = [];

// Pagination state
let currentPage = 1;
let pageSize = 10;

// Sort state
let currentSortColumn = null;
let currentSortDirection = 'none'; // 'asc', 'desc', 'none'

// ==================== FETCH API ====================

/**
 * Hàm getAll - Lấy tất cả sản phẩm từ API
 * @returns {Promise<Array>} Danh sách sản phẩm
 */
async function getAllProducts() {
    try {
        showLoading(true);
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const products = await response.json();
        console.log('Products loaded:', products.length);
        console.log('First product images:', products[0]?.images);
        return products;
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu:', error);
        showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
        return [];
    } finally {
        showLoading(false);
    }
}

// ==================== RENDER TABLE ====================

/**
 * Render bảng sản phẩm với pagination
 * @param {Array} products - Danh sách sản phẩm cần hiển thị
 */
function renderTable(products) {
    // Cập nhật filteredProducts
    filteredProducts = products;
    
    if (products.length === 0) {
        productTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="no-results">
                    Không tìm thấy sản phẩm nào.
                </td>
            </tr>
        `;
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }

    // Tính toán pagination
    const totalPages = Math.ceil(products.length / pageSize);
    
    // Đảm bảo currentPage không vượt quá totalPages
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = products.slice(startIndex, endIndex);

    // Render sản phẩm
    productTableBody.innerHTML = paginatedProducts.map(product => {
        const placeholderUrl = 'https://placehold.co/100x100?text=No+Image';
        
        // Lấy URL ảnh từ API và dùng proxy để bypass imgur hotlinking
        let imageUrl = placeholderUrl;
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            imageUrl = getProxiedImageUrl(product.images[0]);
        }
        
        // Category name
        const categoryName = product.category ? product.category.name : 'N/A';
        
        // Description cho tooltip
        const description = product.description || 'Không có mô tả';
        
        return `
            <tr>
                <td>${product.id}</td>
                <td>
                    <img src="${imageUrl}" 
                         alt="${escapeHtml(product.title)}" 
                         class="product-image"
                         onerror="this.onerror=null; this.src='${placeholderUrl}';"
                         loading="lazy">
                </td>
                <td class="product-title-cell" title="${escapeHtml(description)}">
                    <span class="product-title">${escapeHtml(product.title)}</span>
                    <span class="tooltip-text">${escapeHtml(description)}</span>
                </td>
                <td class="price">$${formatPrice(product.price)}</td>
                <td>
                    <span class="category-badge">${escapeHtml(categoryName)}</span>
                </td>
            </tr>
        `;
    }).join('');

    // Render pagination
    renderPagination(totalPages);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Hiển thị/ẩn loading
 */
function showLoading(show) {
    loadingElement.classList.toggle('show', show);
    document.getElementById('productTable').style.display = show ? 'none' : 'table';
}

/**
 * Hiển thị lỗi
 */
function showError(message) {
    productTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="no-results" style="color: #e74c3c;">
                ${message}
            </td>
        </tr>
    `;
}

/**
 * Escape HTML để tránh XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format giá tiền
 */
function formatPrice(price) {
    return parseFloat(price).toFixed(2);
}

/**
 * Chuyển đổi URL imgur sang proxy để bypass hotlinking
 * Sử dụng wsrv.nl làm image proxy
 */
function getProxiedImageUrl(originalUrl) {
    if (!originalUrl || typeof originalUrl !== 'string') {
        return 'https://placehold.co/100x100?text=No+Image';
    }
    
    // Làm sạch URL (loại bỏ dấu ngoặc kép thừa nếu có)
    let cleanUrl = originalUrl.replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim();
    
    // Kiểm tra URL hợp lệ
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return 'https://placehold.co/100x100?text=No+Image';
    }
    
    // Lấy phần path từ URL imgur (vd: QkIa5tT.jpeg)
    // Sử dụng wsrv.nl proxy - không cần encode
    return `https://wsrv.nl/?url=${cleanUrl}&w=100&h=100&fit=cover`;
}

// ==================== SEARCH FUNCTION ====================

/**
 * Tìm kiếm sản phẩm theo title
 * @param {string} keyword - Từ khóa tìm kiếm
 */
function searchProducts(keyword) {
    const searchTerm = keyword.toLowerCase().trim();
    
    // Reset về trang 1 khi tìm kiếm
    currentPage = 1;
    
    // Reset sort state
    currentSortColumn = null;
    currentSortDirection = 'none';
    updateSortIcons();
    
    if (searchTerm === '') {
        // Nếu không có từ khóa, hiển thị tất cả
        filteredProducts = [...allProducts];
        renderTable(filteredProducts);
        return;
    }
    
    // Lọc sản phẩm theo title
    const results = allProducts.filter(product => 
        product.title.toLowerCase().includes(searchTerm)
    );
    
    filteredProducts = results;
    renderTable(filteredProducts);
}

// ==================== PAGINATION FUNCTIONS ====================

/**
 * Render pagination controls
 * @param {number} totalPages - Tổng số trang
 */
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    const paginationNumbers = document.getElementById('paginationNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Hiển thị pagination container
    paginationContainer.style.display = 'flex';
    
    // Disable/enable prev/next buttons
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // Render page numbers
    let paginationHTML = '';
    
    // Logic hiển thị số trang (giới hạn hiển thị để không quá dài)
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Điều chỉnh startPage nếu endPage đã đạt max
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-num" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationHTML += `<button class="pagination-num ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="pagination-num" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    paginationNumbers.innerHTML = paginationHTML;
}

/**
 * Chuyển đến trang cụ thể
 * @param {number} page - Số trang
 */
function goToPage(page) {
    currentPage = page;
    renderTable(filteredProducts);
    
    // Scroll lên đầu bảng
    document.getElementById('productTable').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Chuyển đến trang trước
 */
function prevPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

/**
 * Chuyển đến trang sau
 */
function nextPage() {
    const totalPages = Math.ceil(filteredProducts.length / pageSize);
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

/**
 * Thay đổi số lượng sản phẩm mỗi trang
 * @param {number} size - Số lượng sản phẩm
 */
function changePageSize(size) {
    pageSize = size;
    currentPage = 1; // Reset về trang 1
    renderTable(filteredProducts);
}

// ==================== SORT FUNCTIONS ====================

/**
 * Sắp xếp sản phẩm theo cột
 * @param {string} column - Tên cột (title, price)
 */
function sortProducts(column) {
    // Xác định hướng sắp xếp
    if (currentSortColumn === column) {
        // Cycle: none -> asc -> desc -> none
        if (currentSortDirection === 'none') {
            currentSortDirection = 'asc';
        } else if (currentSortDirection === 'asc') {
            currentSortDirection = 'desc';
        } else {
            currentSortDirection = 'none';
        }
    } else {
        // Cột mới, bắt đầu với asc
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // Reset về trang 1
    currentPage = 1;
    
    // Cập nhật icon
    updateSortIcons();
    
    // Nếu không sắp xếp, giữ nguyên thứ tự đã lọc
    if (currentSortDirection === 'none') {
        // Lấy lại kết quả tìm kiếm hiện tại
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        if (searchTerm === '') {
            filteredProducts = [...allProducts];
        } else {
            filteredProducts = allProducts.filter(product => 
                product.title.toLowerCase().includes(searchTerm)
            );
        }
        renderTable(filteredProducts);
        return;
    }
    
    // Sắp xếp
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        let valueA, valueB;
        
        if (column === 'title') {
            valueA = a.title.toLowerCase();
            valueB = b.title.toLowerCase();
        } else if (column === 'price') {
            valueA = parseFloat(a.price);
            valueB = parseFloat(b.price);
        }
        
        if (currentSortDirection === 'asc') {
            if (valueA < valueB) return -1;
            if (valueA > valueB) return 1;
            return 0;
        } else {
            if (valueA > valueB) return -1;
            if (valueA < valueB) return 1;
            return 0;
        }
    });
    
    filteredProducts = sortedProducts;
    renderTable(filteredProducts);
}

/**
 * Cập nhật icon sắp xếp trên header
 */
function updateSortIcons() {
    // Reset tất cả icons
    const sortIcons = document.querySelectorAll('.sort-icon');
    sortIcons.forEach(icon => {
        icon.textContent = '⇅';
        icon.classList.remove('asc', 'desc');
    });
    
    // Cập nhật icon cho cột đang được sắp xếp
    if (currentSortColumn && currentSortDirection !== 'none') {
        const activeIcon = document.getElementById(`sort-${currentSortColumn}`);
        if (activeIcon) {
            if (currentSortDirection === 'asc') {
                activeIcon.textContent = '↑';
                activeIcon.classList.add('asc');
            } else {
                activeIcon.textContent = '↓';
                activeIcon.classList.add('desc');
            }
        }
    }
}

// ==================== INITIALIZATION ====================

/**
 * Khởi tạo ứng dụng
 */
async function init() {
    // Lấy dữ liệu từ API
    allProducts = await getAllProducts();
    filteredProducts = allProducts;
    
    // Hiển thị dữ liệu
    renderTable(allProducts);
    
    // Thêm event listener cho ô tìm kiếm
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchProducts(e.target.value);
        });
    }
    
    // Event listener cho page size select
    const pageSizeSelect = document.getElementById('pageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            changePageSize(parseInt(e.target.value));
        });
    }
    
    // Event listeners cho pagination buttons
    document.getElementById('prevBtn').addEventListener('click', prevPage);
    document.getElementById('nextBtn').addEventListener('click', nextPage);
}

// Chạy khi DOM ready
document.addEventListener('DOMContentLoaded', init);
