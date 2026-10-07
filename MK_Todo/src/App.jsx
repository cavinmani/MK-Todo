import { useState, useEffect } from 'react';
import Login from './Screens/Main/Login';
import Signup from './Screens/Main/Signup';
import Welcome from './Screens/Main/Welcome';
import Home from './Screens/Main/Home';
import Calendar from './Screens/Main/Calendar';
import Photos from './Screens/Main/Photos';
import Folder from './Screens/Components/folder';
import FloatingNav from './Screens/Components/Floatingnav';

// Session keys stored in localStorage
const SESSION_KEY = 'mk_session_screen';
const FOLDER_KEY = 'mk_session_folder';
const USER_KEY = 'mk_session_user';

// Screens that show the floating nav
const NAV_SCREENS = ['home', 'calendar', 'photos', 'folder'];

function App() {
  // Restore screen from localStorage on refresh
  const [currentScreen, setCurrentScreen] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (NAV_SCREENS.includes(saved)) return saved;
    } catch (_) {}
    return 'login';
  });

  // Logged-in user info
  const [loggedInUser, setLoggedInUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });

  // Restore selected folder from localStorage
  const [selectedFolder, setSelectedFolder] = useState(() => {
    try {
      const raw = localStorage.getItem(FOLDER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });

  // Persist screen to localStorage
  useEffect(() => {
    try {
      if (NAV_SCREENS.includes(currentScreen)) {
        localStorage.setItem(SESSION_KEY, currentScreen);
      }
    } catch (_) {}
  }, [currentScreen]);

  // Persist logged-in user
  useEffect(() => {
    try {
      if (loggedInUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (_) {}
  }, [loggedInUser]);

  // Persist selected folder
  useEffect(() => {
    try {
      if (selectedFolder) {
        localStorage.setItem(FOLDER_KEY, JSON.stringify(selectedFolder));
      } else {
        localStorage.removeItem(FOLDER_KEY);
      }
    } catch (_) {}
  }, [selectedFolder]);

  const handleLoginSuccess = (user) => {
    setLoggedInUser(user);
    setCurrentScreen('welcome');
  };

  const handleSignupSuccess = (user) => {
    setLoggedInUser(user);
    setCurrentScreen('welcome');
  };

  const handleWelcomeFinish = () => setCurrentScreen('home');

  const handleOpenFolder = (folder) => {
    setSelectedFolder(folder);
    setCurrentScreen('folder');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(FOLDER_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (_) {}
    setLoggedInUser(null);
    setSelectedFolder(null);
    setCurrentScreen('login');
  };

  const handleBackToHome = () => {
    setSelectedFolder(null);
    setCurrentScreen('home');
  };

  // For FloatingNav: folder highlights 'home'
  const navActiveScreen = currentScreen === 'folder' ? 'home' : currentScreen;

  const userName = loggedInUser?.name || '';

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToSignup={() => setCurrentScreen('signup')}
          />
        );
      case 'signup':
        return (
          <Signup
            onSignupSuccess={handleSignupSuccess}
            onGoToLogin={() => setCurrentScreen('login')}
          />
        );
      case 'welcome':
        return <Welcome userName={userName} onFinish={handleWelcomeFinish} />;
      case 'home':
        return (
          <Home
            onNavigateToCalendar={() => setCurrentScreen('calendar')}
            onLogout={handleLogout}
            onOpenFolder={handleOpenFolder}
          />
        );
      case 'folder':
        return (
          <Folder
            folder={selectedFolder}
            onBack={handleBackToHome}
            onLogout={handleLogout}
          />
        );
      case 'photos':
        return <Photos />;
      case 'calendar':
        return <Calendar onLogout={handleLogout} onBackToHome={handleBackToHome} />;
      default:
        return (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToSignup={() => setCurrentScreen('signup')}
          />
        );
    }
  };

  return (
    <>
      {renderScreen()}

      {/* Floating bottom nav — visible on all authenticated screens */}
      {NAV_SCREENS.includes(currentScreen) && (
        <FloatingNav
          activeScreen={navActiveScreen}
          onHome={handleBackToHome}
          onPhotos={() => setCurrentScreen('photos')}
          onCalendar={() => setCurrentScreen('calendar')}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

export default App;
