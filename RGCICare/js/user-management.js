import { db, collection, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from './firebase-config.js';
import { showToast } from './auth.js';

// Get all users
export async function getAllUsers() {
    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, users };
    } catch (error) {
        console.error('Error fetching users:', error);
        return { success: false, error: error.message };
    }
}

// Get user by ID
export async function getUserById(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return { success: true, user: { id: userDoc.id, ...userDoc.data() } };
        }
        return { success: false, error: 'User not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Update user profile
export async function updateUser(userId, updateData) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            ...updateData,
            updatedAt: Timestamp.now()
        });
        showToast('User updated successfully', 'success');
        return { success: true };
    } catch (error) {
        showToast('Error updating user', 'error');
        return { success: false, error: error.message };
    }
}

// Update user role
export async function updateUserRole(userId, newRole) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            role: newRole,
            updatedAt: Timestamp.now()
        });
        showToast(`Role updated to ${newRole}`, 'success');
        return { success: true };
    } catch (error) {
        showToast('Error updating role', 'error');
        return { success: false, error: error.message };
    }
}

// Activate/Deactivate user
export async function toggleUserStatus(userId, isActive) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            isActive: isActive,
            updatedAt: Timestamp.now()
        });
        showToast(`User ${isActive ? 'activated' : 'deactivated'}`, 'success');
        return { success: true };
    } catch (error) {
        showToast('Error updating status', 'error');
        return { success: false, error: error.message };
    }
}

// Delete user (admin only)
export async function deleteUser(userId) {
    try {
        await deleteDoc(doc(db, 'users', userId));
        showToast('User deleted successfully', 'success');
        return { success: true };
    } catch (error) {
        showToast('Error deleting user', 'error');
        return { success: false, error: error.message };
    }
}

// Get users by role
export async function getUsersByRole(role) {
    try {
        const q = query(collection(db, 'users'), where('role', '==', role));
        const snapshot = await getDocs(q);
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, users };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Get active users count
export async function getActiveUsersCount() {
    try {
        const q = query(collection(db, 'users'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        return { success: true, count: snapshot.size };
    } catch (error) {
        return { success: false, count: 0 };
    }
}