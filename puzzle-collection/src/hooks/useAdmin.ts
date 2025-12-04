import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';

const ADMIN_EMAILS = [
    'bousseauvictor49@gmail.com'
];

export function useAdmin(user: User | null) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    return isAdmin;
}
