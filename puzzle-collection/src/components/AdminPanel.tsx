import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';

export function AdminPanel() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleResetScores = async () => {
        if (!confirm("Are you sure you want to DELETE ALL SCORES for today? This cannot be undone.")) return;

        setLoading(true);
        setMessage("");
        try {
            const today = new Date().toISOString().split('T')[0];
            const q = query(
                collection(db, "scores"),
                where("challengeDate", "==", today)
            );
            const snapshot = await getDocs(q);

            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);

            setMessage(`Successfully deleted ${snapshot.size} scores.`);
        } catch (e: any) {
            console.error(e);
            setMessage("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRerollGrid = async () => {
        if (!confirm("Are you sure you want to REROLL the daily grid? This will change the puzzle for everyone.")) return;

        setLoading(true);
        setMessage("");
        try {
            const today = new Date().toISOString().split('T')[0];
            const configRef = doc(db, "dailyConfig", today);
            const configSnap = await getDoc(configRef);

            if (configSnap.exists()) {
                await updateDoc(configRef, {
                    seedVersion: increment(1)
                });
            } else {
                await setDoc(configRef, {
                    seedVersion: 1
                });
            }

            setMessage("Daily grid rerolled (version incremented).");
        } catch (e: any) {
            console.error(e);
            setMessage("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm mb-6">
            <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2">
                <span>🛡️</span> Admin Panel
            </h3>

            <div className="flex gap-4 flex-wrap">
                <button
                    onClick={handleResetScores}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                    Reset Today's Scores
                </button>
                <button
                    onClick={handleRerollGrid}
                    disabled={loading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                    Reroll Daily Grid
                </button>
            </div>

            {message && (
                <div className="mt-3 text-sm font-medium text-gray-700 bg-white p-2 rounded border border-gray-200 inline-block">
                    {message}
                </div>
            )}
        </div>
    );
}
