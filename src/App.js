import React, { useState, useEffect } from 'react';

// --- Configuration ---
// Replace this with your actual Azure App Service URL
const API_BASE_URL = 'https://pusadseva-api.azurewebsites.net';

// --- Main App Component ---
export default function App() {
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Data Fetching ---
  useEffect(() => {
    // This function fetches the list of professionals from our live API
    const fetchProfessionals = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // We call the /api/professionals endpoint we built
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

    fetchProfessionals();
  }, []); // The empty array [] means this effect runs once when the component mounts

  // --- Event Handlers ---
  const handleSelectProfessional = (professional) => {
    setSelectedProfessional(professional);
  };

  const handleGoBack = () => {
    setSelectedProfessional(null);
  };

  // --- UI Rendering ---
  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <Header />
      <main className="p-4">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        
        {!isLoading && !error && (
          // If a professional is selected, show their details. Otherwise, show the list.
          selectedProfessional ? (
            <ProfessionalDetails professional={selectedProfessional} onBack={handleGoBack} />
          ) : (
            <ProfessionalList professionals={professionals} onSelect={handleSelectProfessional} />
          )
        )}
      </main>
    </div>
  );
}

// --- UI Components ---

const Header = () => (
  <header className="bg-blue-600 text-white shadow-md">
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center">Pusad Local Services</h1>
    </div>
  </header>
);

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
        <span className="text-gray-600 ml-1">{professional.Rating.toFixed(1)}</span>
      </div>
    </div>
  </div>
);

const ProfessionalDetails = ({ professional, onBack }) => (
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
        <span className="text-gray-700 ml-2 text-lg">{professional.Rating.toFixed(1)} / 5.0</span>
      </div>
      {professional.IsVerified && (
        <div className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
          Verified Professional
        </div>
      )}
      <div className="mt-6 w-full text-center">
        <button className="bg-green-500 text-white font-bold py-3 px-8 rounded-lg w-full hover:bg-green-600 transition-colors">
          Book Now
        </button>
      </div>
    </div>
  </div>
);

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
