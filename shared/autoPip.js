/**
 * Picture-in-Picture support for ArcGIS maps
 */

(function() {
  // Check if browser supports media controls
  if (!('mediaSession' in navigator)) {
    console.log('MediaSession not supported');
    return;
  }

  const setupMediaSession = () => {
    try {
      // Set up basic media controls
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('Media: play');
      });
      
      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('Media: pause');
      });
      
      // Handle PiP properly instead of using unsupported 'enterpictureinpicture'
      
      // Document PiP API
      if ('documentPictureInPicture' in window) {
        console.log('Document PiP supported');
      }
      
      // Video PiP API
      const video = document.querySelector('video');
      if (video && 'pictureInPictureEnabled' in document) {
        console.log('Video PiP supported');
      }
    } catch (error) {
      console.warn('Media session error:', error);
    }
  };

  // Run when page is ready
  if (document.readyState === 'complete') {
    setupMediaSession();
  } else {
    window.addEventListener('load', setupMediaSession);
  }
})(); 