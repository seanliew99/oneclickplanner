// auth.js
// This file handles authentication state and UI updates

document.addEventListener('DOMContentLoaded', function() {
  // Check if user is authenticated
  checkAuthState();
  
  // Handle logout button click
  document.body.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'logout-btn') {
      logout();
    }
  });
});

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
        migratePlanToDynamoDB();
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
        migratePlanToDynamoDB();
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
function migratePlanToDynamoDB() {
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
    userDropdown.className = 'nav-item dropdown ms-3';
    userDropdown.id = 'user-dropdown';
    
    // Use email instead of username for display
    const displayName = userData.email || userData.username || 'User';
    
    userDropdown.innerHTML = `
      <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" 
         data-bs-toggle="dropdown" aria-expanded="false">
        <i class="bi bi-person-circle me-1"></i> ${displayName}
      </a>
      <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
        <li><a class="dropdown-item" href="/profile">My Profile</a></li>
        <li><a class="dropdown-item" href="/itinerary">My Itinerary</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="#" id="logout-btn">Logout</a></li>
      </ul>
    `;
    
    authContainer.appendChild(userDropdown);
  }
}

// Handle logout
function logout() {
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
    if (userDropdown) {
      userDropdown.remove();
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
  loadingElement.className = 'position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center bg-white';
  loadingElement.style.zIndex = '9999';
  loadingElement.innerHTML = `
    <div class="text-center">
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
  // Map type to Bootstrap alert class
  const alertClass = {
    'success': 'alert-success',
    'error': 'alert-danger',
    'warning': 'alert-warning',
    'info': 'alert-info'
  }[type] || 'alert-info';
  
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
    <div class="alert ${alertClass} alert-dismissible fade show mx-auto" style="max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
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