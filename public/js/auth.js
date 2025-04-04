// auth.js
// This file handles authentication state and UI updates

document.addEventListener('DOMContentLoaded', function() {
  // Add the styled dropdown CSS to the head
  addDropdownStyles();
  
  // Check if user is authenticated
  checkAuthState();
  
  // Handle logout button click - updated for new dropdown structure
  document.body.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'logout-btn' || e.target.closest('#logout-btn'))) {
      logout();
    }
  });
});

// Add dropdown styles to document head
function addDropdownStyles() {
  if (!document.getElementById('auth-dropdown-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'auth-dropdown-styles';
    styleTag.textContent = `
      /* User dropdown styling */
      .user-dropdown {
        position: relative;
        z-index: 3000;
        display: inline-block;
      }

      .user-dropdown-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        background: transparent;
        border: none;
        cursor: pointer;
        font-weight: 500;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.3s ease;
      }

      .user-dropdown-toggle:hover {
        background: rgba(255, 255, 255, 0.1);
        text-shadow: 0 0 10px rgba(77, 184, 255, 0.5);
      }

      .user-dropdown-toggle .user-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, #4361ee, #4db8ff);
        border-radius: 50%;
        font-size: 14px;
        color: white;
        box-shadow: 0 0 8px rgba(77, 184, 255, 0.5);
      }

      .user-dropdown-toggle .dropdown-arrow {
        transition: transform 0.3s ease;
      }

      .user-dropdown.show .dropdown-arrow {
        transform: rotate(180deg);
      }

      .user-dropdown-menu {
        position: absolute;

        top: 100%;
        right: 0;
        margin-top: 8px;
        background: rgba(30, 39, 64, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(77, 184, 255, 0.3);
        border-radius: 10px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(77, 184, 255, 0.2);
        min-width: 180px;
        overflow: hidden;
        z-index: 9999;
        
        /* Animation states */
        opacity: 0;
        transform: translateY(-10px);
        visibility: hidden;
        transition: all 0.3s ease;
      }

      .user-dropdown.show .user-dropdown-menu {
        opacity: 1;
        transform: translateY(0);
        visibility: visible;
      }

      .user-dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        color: white;
        font-weight: 500;
        text-decoration: none;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
      }

      .user-dropdown-item:hover {
        background: rgba(255, 255, 255, 0.1);
        border-left-color: #4db8ff;
      }

      .user-dropdown-item i {
        font-size: 1.1em;
        color: rgba(77, 184, 255, 0.8);
      }

      .user-dropdown-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 8px 0;
      }

      .user-dropdown-item.logout {
        color: #ff6f61;
      }

      .user-dropdown-item.logout:hover {
        background: rgba(255, 111, 97, 0.1);
        border-left-color: #ff6f61;
      }

      .user-dropdown-item.logout i {
        color: #ff6f61;
      }

      /* Responsive adjustments */
      @media (max-width: 767.98px) {
        .user-dropdown-toggle .d-none.d-md-inline {
          display: none;
        }
        
        .user-dropdown-toggle {
          padding: 6px;
        }
        
        .user-dropdown-menu {
          right: -10px;
        }
      }

      /* User initial icon color personalization */
      .user-icon[data-initial="A"], .user-icon[data-initial="J"], .user-icon[data-initial="S"] {
        background: linear-gradient(135deg, #4361ee, #4db8ff);
      }

      .user-icon[data-initial="B"], .user-icon[data-initial="K"], .user-icon[data-initial="T"] {
        background: linear-gradient(135deg, #3a86ff, #00c2ff); 
      }

      .user-icon[data-initial="C"], .user-icon[data-initial="L"], .user-icon[data-initial="U"] {
        background: linear-gradient(135deg, #8338ec, #c77dff);
      }

      .user-icon[data-initial="D"], .user-icon[data-initial="M"], .user-icon[data-initial="V"] {
        background: linear-gradient(135deg, #ff006e, #ff5e78);
      }

      .user-icon[data-initial="E"], .user-icon[data-initial="N"], .user-icon[data-initial="W"] {
        background: linear-gradient(135deg, #fb5607, #ff9e00);
      }

      .user-icon[data-initial="F"], .user-icon[data-initial="O"], .user-icon[data-initial="X"] {
        background: linear-gradient(135deg, #00bbf9, #00f5d4);
      }

      .user-icon[data-initial="G"], .user-icon[data-initial="P"], .user-icon[data-initial="Y"] {
        background: linear-gradient(135deg, #9b5de5, #f15bb5);
      }

      .user-icon[data-initial="H"], .user-icon[data-initial="Q"], .user-icon[data-initial="Z"] {
        background: linear-gradient(135deg, #06d6a0, #1b9aaa);
      }

      .user-icon[data-initial="I"], .user-icon[data-initial="R"] {
        background: linear-gradient(135deg, #118ab2, #073b4c);
      }

      /* Subtle enter animation for dropdown options */
      .user-dropdown-item {
        opacity: 0;
        transform: translateX(-5px);
        animation: fadeInRight 0.3s forwards;
      }

      .user-dropdown-item:nth-child(1) {
        animation-delay: 0.05s;
      }

      .user-dropdown-item:nth-child(2) {
        animation-delay: 0.1s;
      }

      .user-dropdown-item:nth-child(4) {
        animation-delay: 0.15s;
      }

      @keyframes fadeInRight {
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(styleTag);
  }
}


// Function to check authentication state
function checkAuthState() {
  // First, check with the server if the user is authenticated
  fetch('/api/auth/user')
    .then(response => response.json())
    .then(data => {
      if (data.authenticated) {
        // User is authenticated according to the server session
        setAuthenticatedUser(data.user);
        
        // Migrate any session plan to DynamoDB
        migratePlanToDB();
      } else {
        // Check for auth token in URL (Cognito redirect with code)
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        
        if (authCode) {
          // The user has been redirected from Cognito with an auth code
          console.log('Auth code detected in URL');
          
          // Show loading indicator
          showLoadingIndicator("Logging you in...");
          
          // Exchange code for tokens through our backend
          fetch(`/api/auth/callback?code=${authCode}`)
            .then(response => {
              if (response.redirected) {
                window.location.href = response.url;
                return;
              }
              return response.json();
            })
            .then(data => {
              if (data && data.error) {
                console.error('Auth error:', data.error);
                showNotification('error', 'Authentication failed. Please try again.');
              } else {
                // Reload page to get updated auth state
                window.location.reload();
              }
            })
            .catch(error => {
              console.error('Auth error:', error);
              showNotification('error', 'Authentication failed. Please try again.');
              hideLoadingIndicator();
              
              // Clean up the URL to remove the code parameter
              const newUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, document.title, newUrl);
            });
        } else {
          // Check for existing authentication in localStorage
          const authUser = localStorage.getItem('authUser');
          if (authUser) {
            try {
              const userData = JSON.parse(authUser);
              
              // Verify with server if this user is actually authenticated
              verifyAuthentication(userData);
            } catch (e) {
              console.error('Error parsing auth user data', e);
              clearAuthState(false); // Don't redirect
            }
          }
        }
      }
    })
    .catch(error => {
      console.error('Error checking auth state:', error);
      
      // Fallback to localStorage
      const authUser = localStorage.getItem('authUser');
      if (authUser) {
        try {
          const userData = JSON.parse(authUser);
          updateUIForAuthenticatedUser(userData);
        } catch (e) {
          console.error('Error parsing auth user data', e);
          clearAuthState(false); // Don't redirect
        }
      }
    });
}

// Verify if user is still authenticated with server
function verifyAuthentication(userData) {
  fetch('/api/auth/user')
    .then(response => response.json())
    .then(data => {
      if (data.authenticated) {
        // Still authenticated, update UI
        updateUIForAuthenticatedUser(userData);
        
        // Migrate any session plan to DynamoDB
        migratePlanToDB();
      } else {
        // No longer authenticated, clear state
        clearAuthState(false); // Don't redirect
        
        // Show notification that session expired
        showNotification('warning', 'Your session has expired. Please log in again.');
      }
    })
    .catch(error => {
      console.error('Error verifying authentication:', error);
      // Keep current state on error to avoid disrupting user
      updateUIForAuthenticatedUser(userData);
    });
}

// Migrate session plan to DynamoDB after login
function migratePlanToDB() {
  fetch('/api/plan/migrate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => response.json())
    .then(data => {
      console.log('Plan migration result:', data.message);
    })
    .catch(error => {
      console.error('Error migrating plan:', error);
    });
}

// Set authenticated user data
function setAuthenticatedUser(userData) {
  localStorage.setItem('authUser', JSON.stringify(userData));
  updateUIForAuthenticatedUser(userData);
}

// Update UI for authenticated user
function updateUIForAuthenticatedUser(userData) {
  const navbarNav = document.getElementById('navbarNav');
  if (!navbarNav) return;
  
  // Find the authentication container in the navbar
  let authContainer = navbarNav.querySelector('.navbar-nav');
  if (!authContainer) return;
  
  // Remove login and signup buttons
  const loginBtn = authContainer.querySelector('a[href*="login"]');
  const signupBtn = authContainer.querySelector('a[href*="signup"]');
  
  if (loginBtn && loginBtn.parentElement) {
    loginBtn.parentElement.remove();
  }
  
  if (signupBtn && signupBtn.parentElement) {
    signupBtn.parentElement.remove();
  }
  
  // Add user info and logout button if they don't already exist
  if (!document.getElementById('user-dropdown')) {
    const userDropdown = document.createElement('li');
    userDropdown.className = 'nav-item ms-3';
    
    // Use email instead of username for display
    const displayName = userData.email || userData.username || 'User';
    const firstLetter = displayName.charAt(0).toUpperCase();
    
    // Create the new styled dropdown HTML
    userDropdown.innerHTML = `
      <div class="user-dropdown" id="user-dropdown">
        <button type="button" class="user-dropdown-toggle" id="userDropdownToggle">
          <div class="user-icon" data-initial="${firstLetter}">
            <span>${firstLetter}</span>
          </div>
          <span class="d-none d-md-inline">${displayName}</span>
          <i class="bi bi-chevron-down dropdown-arrow"></i>
        </button>
        
        <div class="user-dropdown-menu" id="userDropdownMenu">
          <a href="/itinerary" class="user-dropdown-item">
            <i class="bi bi-map"></i>
            My Itinerary
          </a>
          <div class="user-dropdown-divider"></div>
          <a href="#" class="user-dropdown-item logout" id="logout-btn">
            <i class="bi bi-box-arrow-right"></i>
            Logout
          </a>
        </div>
      </div>
    `;
    
    authContainer.appendChild(userDropdown);
    
    // Initialize the dropdown functionality
    initializeDropdown();
  }
}

// Initialize the dropdown functionality
function initializeDropdown() {
  const dropdown = document.querySelector('.user-dropdown');
  const dropdownToggle = document.getElementById('userDropdownToggle');
  
  if (dropdownToggle) {
    // Toggle dropdown when button is clicked
    dropdownToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
    
    // Close dropdown when escape key is pressed
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        dropdown.classList.remove('show');
      }
    });
  }
}

// Handle logout
function logout() {
  // Close dropdown if open
  const dropdown = document.querySelector('.user-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }

  // Call server-side logout endpoint
  fetch('/api/auth/logout')
    .then(response => {
      clearAuthState(false); // Don't redirect, we'll handle it
      
      // Create a logout notification
      createLogoutNotification();
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        if (response.redirected) {
          window.location.href = response.url;
        } else {
          window.location.href = '/';
        }
      }, 1500); // Delay for 1.5 seconds to show the notification
    })
    .catch(error => {
      console.error('Error during logout:', error);
      
      // Fallback to client-side logout
      clearAuthState(true);
    });
}


// Clear authentication state
function clearAuthState(shouldRedirect = true) {
  localStorage.removeItem('authUser');
  // Add a flag in session storage to show notification after page load
  sessionStorage.setItem('showLogoutNotification', 'true');
  
  // Update UI to show login/signup buttons
  const navbarNav = document.getElementById('navbarNav');
  if (navbarNav) {
    const userDropdown = document.getElementById('user-dropdown');
    if (userDropdown && userDropdown.closest('li')) {
      userDropdown.closest('li').remove();
    }
    
    // Add login and signup buttons back if they don't exist
    const authContainer = navbarNav.querySelector('.navbar-nav');
    if (authContainer && !authContainer.querySelector('a[href*="login"]')) {
      const loginItem = document.createElement('li');
      loginItem.className = 'nav-item ms-3';
      loginItem.innerHTML = `<a class="btn btn-outline-light" href="https://us-east-1zjt65d7ot.auth.us-east-1.amazoncognito.com/login?client_id=3anj5rhtknc7i97jq3jgknai71&response_type=code&scope=email+openid+phone&redirect_uri=http%3A%2F%2Flocalhost%3A3000">Login</a>`;
      authContainer.appendChild(loginItem);
      
      const signupItem = document.createElement('li');
      signupItem.className = 'nav-item ms-2';
      signupItem.innerHTML = `<a class="btn btn-outline-light" href="https://us-east-1zjt65d7ot.auth.us-east-1.amazoncognito.com/signup?client_id=3anj5rhtknc7i97jq3jgknai71&redirect_uri=http%3A%2F%2Flocalhost%3A3000&response_type=code&scope=email+openid+phone">Sign Up</a>`;
      authContainer.appendChild(signupItem);
    }
  }
  
  if (shouldRedirect) {
    // Redirect to Cognito logout if needed
    window.location.href = 'https://us-east-1zjt65d7ot.auth.us-east-1.amazoncognito.com/logout?client_id=3anj5rhtknc7i97jq3jgknai71&logout_uri=http%3A%2F%2Flocalhost%3A3000';
  }
}

// Create logout notification
function createLogoutNotification() {
  showNotification('success', 'You have been successfully logged out.');
}

// Show loading indicator
function showLoadingIndicator(message = 'Loading...') {
  const loadingElement = document.createElement('div');
  loadingElement.id = 'auth-loading-indicator';
  loadingElement.className = 'position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center bg-dark bg-opacity-75';
  loadingElement.style.zIndex = '9999';
  loadingElement.innerHTML = `
    <div class="text-center text-white">
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(loadingElement);
}

// Hide loading indicator
function hideLoadingIndicator() {
  const loadingElement = document.getElementById('auth-loading-indicator');
  if (loadingElement) {
    loadingElement.remove();
  }
}

// Generic notification function
function showNotification(type, message) {
  // Map type to Bootstrap alert class with dark theme
  const alertClass = {
    'success': 'bg-success bg-opacity-25 text-success border-success',
    'error': 'bg-danger bg-opacity-25 text-danger border-danger',
    'warning': 'bg-warning bg-opacity-25 text-warning border-warning',
    'info': 'bg-info bg-opacity-25 text-info border-info'
  }[type] || 'bg-info bg-opacity-25 text-info border-info';
  
  // Map type to Bootstrap icon
  const iconClass = {
    'success': 'bi-check-circle-fill',
    'error': 'bi-exclamation-triangle-fill',
    'warning': 'bi-exclamation-circle-fill',
    'info': 'bi-info-circle-fill'
  }[type] || 'bi-info-circle-fill';
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'position-fixed top-0 start-0 end-0 p-3 text-center';
  notification.style.zIndex = '1070';
  notification.innerHTML = `
    <div class="alert fade show mx-auto border ${alertClass}" style="max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); backdrop-filter: blur(10px);">
      <i class="bi ${iconClass} me-2"></i>
      <strong>${type.charAt(0).toUpperCase() + type.slice(1)}!</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.querySelector('.alert').classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Check for logout notification flag on page load
document.addEventListener('DOMContentLoaded', function() {
  if (sessionStorage.getItem('showLogoutNotification') === 'true') {
    sessionStorage.removeItem('showLogoutNotification');
    showNotification('success', 'You have been successfully logged out.');
  }
});