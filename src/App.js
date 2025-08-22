import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, query, serverTimestamp } from 'firebase/firestore';

// --- Helper Functions and Constants ---

// IMPORTANT: These global variables are provided by the environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-whiteboard-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- React Components ---

const ColorPalette = ({ selectedColor, onColorChange }) => {
    const colors = ['#000000', '#EF4444', '#F97316', '#84CC16', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6'];
    return (
        <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded-lg shadow-md">
            {colors.map(color => (
                <button
                    key={color}
                    onClick={() => onColorChange(color)}
                    className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                />
            ))}
        </div>
    );
};

const ToolButton = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`p-3 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-blue-500 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        title={label}
    >
        {icon}
        <span className="sr-only">{label}</span>
    </button>
);

// Main App Component
const App = () => {
    // --- State Management ---
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawing, setDrawing] = useState(null); // The element currently being drawn
    const [elements, setElements] = useState([]); // All elements on the canvas
    const [tool, setTool] = useState('pen'); // 'pen', 'rectangle', 'circle', 'eraser'
    const [color, setColor] = useState('#000000');
    
    // Firebase state
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [authError, setAuthError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase config is not available.");
            setAuthError("Application is not configured correctly.");
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const firestore = getFirestore(app);
            setDb(firestore);

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // If no user, attempt to sign in.
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) {
                        console.error("Firebase sign-in failed:", error);
                        setAuthError("Could not connect to the collaborative session.");
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setAuthError("Failed to initialize the application.");
        }
    }, []);

    // --- Firestore Real-time Sync ---
    useEffect(() => {
        // Only setup listener if db and auth are ready
        if (!isAuthReady || !db) return;

        const drawingsCollectionPath = `/artifacts/${appId}/public/data/drawings`;
        const q = query(collection(db, drawingsCollectionPath));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedElements = [];
            snapshot.forEach((doc) => {
                fetchedElements.push({ id: doc.id, ...doc.data() });
            });
            // Sort to ensure consistent drawing order
            fetchedElements.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
            setElements(fetchedElements);
        }, (error) => {
            console.error("Error fetching drawings from Firestore:", error);
        });

        return () => unsubscribe();

    }, [isAuthReady, db]); // Rerun when auth state or db instance changes

    // --- Canvas Drawing Logic ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Resize canvas to fit container
        const resizeCanvas = () => {
            const { width, height } = canvas.getBoundingClientRect();
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
        };

        const redraw = () => {
            resizeCanvas();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw all synced elements
            elements.forEach(el => drawElement(ctx, el));
            // Draw the element currently being created
            if (drawing) {
                drawElement(ctx, drawing);
            }
        };

        redraw();

        // Redraw on window resize
        window.addEventListener('resize', redraw);
        return () => window.removeEventListener('resize', redraw);

    }, [elements, drawing]); // Redraw when elements or the current drawing changes

    const getCoords = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const drawElement = (ctx, el) => {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (el.type) {
            case 'pen':
                ctx.beginPath();
                el.points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
                break;
            case 'rectangle':
                ctx.strokeRect(el.x, el.y, el.width, el.height);
                break;
            case 'circle':
                ctx.beginPath();
                const radius = Math.sqrt(Math.pow(el.width, 2) + Math.pow(el.height, 2));
                ctx.arc(el.x, el.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            default:
                break;
        }
    };

    const createElement = (id, x, y) => {
        switch (tool) {
            case 'pen':
                return { id, type: 'pen', points: [{ x, y }], color, userId };
            case 'rectangle':
                return { id, type: 'rectangle', x, y, width: 0, height: 0, color, userId };
            case 'circle':
                return { id, type: 'circle', x, y, width: 0, height: 0, color, userId };
            default:
                return null;
        }
    };
    
    // --- Event Handlers ---
    const handleMouseDown = (e) => {
        if (!isAuthReady || !db) return;
        const { x, y } = getCoords(e);
        setIsDrawing(true);
        
        if (tool === 'eraser') {
            // Eraser logic can be implemented here by finding and deleting nearby elements
            return;
        }

        const id = `${userId}-${Date.now()}`;
        const newElement = createElement(id, x, y);
        if (newElement) {
            setDrawing(newElement);
        }
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !drawing) return;
        const { x, y } = getCoords(e);

        setDrawing(prevDrawing => {
            const updatedElement = { ...prevDrawing };
            switch (updatedElement.type) {
                case 'pen':
                    updatedElement.points = [...updatedElement.points, { x, y }];
                    break;
                case 'rectangle':
                case 'circle':
                    updatedElement.width = x - updatedElement.x;
                    updatedElement.height = y - updatedElement.y;
                    break;
                default:
                    break;
            }
            return updatedElement;
        });
    };

    const handleMouseUp = async () => {
        if (!isDrawing || !drawing || !db) return;
        
        // Finalize the element and save to Firestore
        const drawingsCollectionPath = `/artifacts/${appId}/public/data/drawings`;
        const docRef = doc(db, drawingsCollectionPath, drawing.id);
        
        try {
            await setDoc(docRef, { ...drawing, timestamp: serverTimestamp() });
        } catch (error) {
            console.error("Failed to save drawing:", error);
        }

        setIsDrawing(false);
        setDrawing(null);
    };
    
    const handleClearCanvas = async () => {
        if (!db) return;
        const confirmation = window.confirm("Are you sure you want to clear the canvas for everyone?");
        if (confirmation) {
            const drawingsCollectionPath = `/artifacts/${appId}/public/data/drawings`;
            elements.forEach(async (el) => {
                try {
                    await deleteDoc(doc(db, drawingsCollectionPath, el.id));
                } catch (error) {
                    console.error("Failed to delete element:", el.id, error);
                }
            });
        }
    };

    return (
        <div className="font-sans bg-gray-50 flex flex-col h-screen w-full">
            {/* Header */}
            <header className="p-4 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between z-10">
                <h1 className="text-xl font-bold text-gray-800">Collaborative Whiteboard</h1>
                {userId ? (
                    <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        User ID: <span className="font-mono">{userId}</span>
                    </div>
                ) : (
                     <div className="text-xs text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full">Connecting...</div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-grow relative">
                 <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp} // End drawing if mouse leaves canvas
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                    className="absolute top-0 left-0 w-full h-full"
                />
            </main>
            
            {/* Toolbar */}
            <footer className="p-4 flex items-center justify-center gap-4 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-2 bg-white p-2 rounded-lg shadow-md">
                    <ToolButton icon={<PencilIcon />} label="Pen" isActive={tool === 'pen'} onClick={() => setTool('pen')} />
                    <ToolButton icon={<SquareIcon />} label="Rectangle" isActive={tool === 'rectangle'} onClick={() => setTool('rectangle')} />
                    <ToolButton icon={<CircleIcon />} label="Circle" isActive={tool === 'circle'} onClick={() => setTool('circle')} />
                </div>
                <ColorPalette selectedColor={color} onColorChange={setColor} />
                 <button 
                    onClick={handleClearCanvas}
                    className="p-3 rounded-lg flex items-center justify-center bg-red-500 text-white hover:bg-red-600 shadow-md transition-all"
                    title="Clear Canvas"
                >
                    <TrashIcon />
                </button>
            </footer>

            {/* Auth Error Message */}
            {authError && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-20" role="alert">
                    <strong className="font-bold">Connection Error: </strong>
                    <span className="block sm:inline">{authError}</span>
                </div>
            )}
        </div>
    );
};

// --- SVG Icons ---
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
const SquareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>;
const CircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;

export default App;
