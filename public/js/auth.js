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
  // Check for auth token in URL (Cognito redirect with code)
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');
  
  if (authCode) {
    // The user has been redirected from Cognito with an auth code
    console.log('Auth code detected in URL');
    
    // Exchange code for tokens (this would be handled by your backend)
    // For now, we'll simulate a successful authentication
    setAuthenticatedUser({
      username: 'User', // This would come from your token
      email: 'user@example.com'
    });
    
    // Clean up the URL to remove the code parameter
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    return;
  }
  
  // Check for existing authentication in localStorage
  const authUser = localStorage.getItem('authUser');
  if (authUser) {
    try {
      const userData = JSON.parse(authUser);
      updateUIForAuthenticatedUser(userData);
    } catch (e) {
      console.error('Error parsing auth user data', e);
      clearAuthState();
    }
  }
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
    
    userDropdown.innerHTML = `
      <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" 
         data-bs-toggle="dropdown" aria-expanded="false">
        <i class="bi bi-person-circle me-1"></i> ${userData.username || 'User'}
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
  clearAuthState();
  
  // Create a logout notification
  createLogoutNotification();
  
  // Redirect to home page after a short delay
  setTimeout(() => {
    window.location.href = '/';
  }, 1500); // Delay for 1.5 seconds to show the notification
}

// Clear authentication state
function clearAuthState() {
  localStorage.removeItem('authUser');
  // Add a flag in session storage to show notification after page load
  sessionStorage.setItem('showLogoutNotification', 'true');
  
  // Redirect to Cognito logout if needed
  // window.location.href = 'https://your-cognito-domain.auth.region.amazoncognito.com/logout?client_id=YOUR_CLIENT_ID&logout_uri=http://localhost:3000/';
}

// Create logout notification
function createLogoutNotification() {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'position-fixed top-0 start-0 end-0 p-3 text-center';
  notification.style.zIndex = '1070';
  notification.innerHTML = `
    <div class="alert alert-success alert-dismissible fade show mx-auto" style="max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
      <i class="bi bi-check-circle-fill me-2"></i>
      <strong>Success!</strong> You have been successfully logged out.
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