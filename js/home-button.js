// Add a discreet home button to all pages
document.addEventListener('DOMContentLoaded', function() {
    // Create home button
    const homeBtn = document.createElement('a');
    homeBtn.href = 'index.html';
    homeBtn.className = 'home-button';
    homeBtn.title = 'Back to Home';
    homeBtn.innerHTML = '⌂';
    
    // Add button to body
    document.body.insertBefore(homeBtn, document.body.firstChild);
});
