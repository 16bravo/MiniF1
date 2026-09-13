// Add a discreet home button to all pages
document.addEventListener('DOMContentLoaded', function() {
    // Create home button
    const homeBtn = document.createElement('a');
    homeBtn.href = 'index.html';
    homeBtn.className = 'home-button';
    homeBtn.title = 'Back to Home';
    // Use the Font Awesome house icon (matches the trophy icon in the quali/
    // race top-right row) on pages that load it; fall back to the plain
    // glyph elsewhere, since most pages don't pull in Font Awesome.
    const hasFontAwesome = !!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]');
    homeBtn.innerHTML = hasFontAwesome ? '<i class="fas fa-home"></i>' : '⌂';

    // Add button to body
    document.body.insertBefore(homeBtn, document.body.firstChild);
});
