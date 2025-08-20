import React, { useState, useEffect } from 'react';

// --- Configuration ---
const API_BASE_URL = 'https://pusadseva-api.azurewebsites.net';

// --- Main App Component ---
export default function App() {
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // --- Data & Auth Fetching ---
  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/.auth/me`); 
        const data = await response.json();
        if (data && data.length > 0 && data[0].user_id) {
          const claims = data[0].user_claims.find(c => c.typ === 'name');
          const userData = {
            ...data[0],
            displayName: claims ? claims.val : data[0].user_id,
          };
          setUser(userData);
        }
      } catch (err) {
        console.error("Could not fetch user auth info:", err);
      }
    };

    const fetchProfessionals = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE_URL}/api/professionals`);
        if (!response.ok) {
          throw new Error('Failed to fetch data from the server.');
        }
        const data = await response.json();
        setProfessionals(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAuth();
    fetchProfessionals();
  }, []);

  // --- Event Handlers ---
  const handleSelectProfessional = (professional) => {
    setSelectedProfessional(professional);
  };

  const handleGoBack = () => {
    setSelectedProfessional(null);
  };

  const handleOpenBookingModal = () => {
    if (!user) {
      alert("Please log in to book a service.");
      // Use the current page's full URL as the redirect target
      const redirectUrl = encodeURIComponent(window.location.href);
      window.location.href = `${API_BASE_URL}/.auth/login/aad?post_login_redirect_uri=${redirectUrl}`; 
      return;
    }
    setIsBooking(true);
  };

  const handleCloseBookingModal = () => {
    setIsBooking(false);
  };

  const handleConfirmBooking = async (bookingDetails) => {
    if (!user) {
      alert("You must be logged in to confirm a booking.");
      return;
    }

    const finalBookingDetails = {
      ...bookingDetails,
      customerId: user.user_id,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalBookingDetails),
        credentials: 'include', 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create the booking.');
      }

      const result = await response.json();
      console.log("Booking successful:", result);
      alert("Booking created successfully!");

    } catch (err) {
      console.error("Booking failed:", err);
      alert(`Booking failed: ${err.message}`);
    } finally {
      handleCloseBookingModal();
    }
  };

  // --- UI Rendering ---
  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <Header user={user} />
      <main className="p-4 container mx-auto">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        
        {!isLoading && !error && (
          selectedProfessional ? (
            <ProfessionalDetails 
              professional={selectedProfessional} 
              onBack={handleGoBack}
              onBookNow={handleOpenBookingModal}
            />
          ) : (
            <ProfessionalList professionals={professionals} onSelect={handleSelectProfessional} />
          )
        )}

        {isBooking && selectedProfessional && (
          <BookingModal 
            professional={selectedProfessional}
            onClose={handleCloseBookingModal}
            onConfirm={handleConfirmBooking}
          />
        )}
      </main>
    </div>
  );
}

// --- UI Components ---

const Header = ({ user }) => {
  // Use the current page's full URL as the redirect target
  const redirectUrl = encodeURIComponent(window.location.href);
  const loginUrl = `${API_BASE_URL}/.auth/login/aad?post_login_redirect_uri=${redirectUrl}`;
  const logoutUrl = `${API_BASE_URL}/.auth/logout?post_logout_redirect_uri=${redirectUrl}`;

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pusad Local Services</h1>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="font-semibold">{user.displayName}</span>
              <a href={logoutUrl} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
                Logout
              </a>
            </div>
          ) : (
            <a href={loginUrl} className="bg-white text-blue-600 font-bold py-2 px-4 rounded hover:bg-gray-200">
              Login
            </a>
          )}
        </div>
      </div>
    </header>
  );
};

const ProfessionalList = ({ professionals, onSelect }) => (
  <div>
    <h2 className="text-xl font-semibold text-gray-700 mb-4">Verified Professionals</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {professionals.map(prof => (
        <ProfessionalCard key={prof.ProfessionalID} professional={prof} onSelect={onSelect} />
      ))}
    </div>
  </div>
);

const ProfessionalCard = ({ professional, onSelect }) => (
  <div 
    className="bg-white rounded-lg shadow-lg p-4 flex items-center cursor-pointer transition-transform transform hover:scale-105"
    onClick={() => onSelect(professional)}
  >
    <img 
      src={professional.ProfilePictureURL || `https://placehold.co/80x80/E2E8F0/4A5568?text=${professional.FirstName.charAt(0)}`} 
      alt={`${professional.FirstName} ${professional.LastName}`}
      className="w-20 h-20 rounded-full mr-4 border-2 border-blue-200"
      onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/E2E8F0/4A5568?text=${professional.FirstName.charAt(0)}`; }}
    />
    <div>
      <h3 className="text-lg font-bold text-gray-800">{`${professional.FirstName} ${professional.LastName}`}</h3>
      <p className="text-blue-500">{professional.ServiceType}</p>
      <div className="flex items-center mt-1">
        <span className="text-yellow-500">★</span>
        <span className="text-gray-600 ml-1">{professional.Rating ? professional.Rating.toFixed(1) : 'N/A'}</span>
      </div>
    </div>
  </div>
);

const ProfessionalDetails = ({ professional, onBack, onBookNow }) => (
  <div className="bg-white rounded-lg shadow-lg p-6">
    <button onClick={onBack} className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg mb-4 hover:bg-blue-600 transition-colors">
      &larr; Back to List
    </button>
    <div className="flex flex-col items-center">
      <img 
        src={professional.ProfilePictureURL || `https://placehold.co/128x128/E2E8F0/4A5568?text=${professional.FirstName.charAt(0)}`} 
        alt={`${professional.FirstName} ${professional.LastName}`}
        className="w-32 h-32 rounded-full mb-4 border-4 border-blue-300"
        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/128x128/E2E8F0/4A5568?text=${professional.FirstName.charAt(0)}`; }}
      />
      <h2 className="text-2xl font-bold text-gray-800">{`${professional.FirstName} ${professional.LastName}`}</h2>
      <p className="text-lg text-blue-600 font-semibold">{professional.ServiceType}</p>
      <div className="flex items-center my-2">
        <span className="text-yellow-500 text-xl">★</span>
        <span className="text-gray-700 ml-2 text-lg">{professional.Rating ? professional.Rating.toFixed(1) : 'N/A'} / 5.0</span>
      </div>
      {professional.IsVerified && (
        <div className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
          Verified Professional
        </div>
      )}
      <div className="mt-6 w-full text-center">
        <button onClick={onBookNow} className="bg-green-500 text-white font-bold py-3 px-8 rounded-lg w-full hover:bg-green-600 transition-colors">
          Book Now
        </button>
      </div>
    </div>
  </div>
);

const BookingModal = ({ professional, onClose, onConfirm }) => {
  const [address, setAddress] = useState('');
  const [dateTime, setDateTime] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!address || !dateTime) {
      alert("Please fill in both address and date/time.");
      return;
    }
    onConfirm({
      professionalId: professional.ProfessionalID,
      address,
      bookingDateTime: dateTime,
      serviceType: professional.ServiceType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md m-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Book {professional.FirstName}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="address" className="block text-gray-700 font-semibold mb-2">Address</label>
            <input 
              type="text" 
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 123 Shivaji Nagar, Pusad"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="dateTime" className="block text-gray-700 font-semibold mb-2">Preferred Date & Time</label>
            <input 
              type="datetime-local" 
              id="dateTime"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors">
              Cancel
            </button>
            <button type="submit" className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
              Confirm Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="text-center p-10">
    <p className="text-gray-600">Loading professionals...</p>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-center">
    <p><strong>Error:</strong> {message}</p>
  </div>
);
