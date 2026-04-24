/**
 * Helper functions for API calls
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';

/**
 * Assign a blocker to an AI agent for action
 * @param {string} blockerId - The blocker ID
 * @param {string} userId - The user ID
 * @param {Object} blockerData - The blocker data including title
 * @returns {Promise<Object>} Response with conversationId and conversationUrl
 *   conversationUrl will be in format: /app/chat?conversation={conversationId}
 */
export async function assignBlockerToAgent(blockerId, userId, blockerData) {
    if (!blockerId || !userId) {
        throw new Error('Missing blockerId or userId');
    }

    if (!blockerData || typeof blockerData.title !== 'string' || !blockerData.title.trim()) {
        console.error('Invalid blockerData:', blockerData);
        throw new Error('Invalid blocker data - missing or invalid title');
    }

    console.log('Calling assign-to-agent API with:', { blockerId, userId, blockerTitle: blockerData.title });

    const response = await fetch(`${API_URL}/api/blockers/assign-to-agent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            blockerId,
            userId,
            blockerData
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Assign blocker result:', result);
    return result;
}

/**
 * Get the list of blockers for a team
 * @param {string} teamId - The team ID
 * @returns {Promise<Array>} Array of blockers
 */
export async function getBlockers(teamId) {
    if (!teamId) {
        throw new Error('Missing teamId');
    }

    const response = await fetch(`${API_URL}/api/blockers?teamId=${encodeURIComponent(teamId)}`);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Create a new blocker
 * @param {Object} blockerData - The blocker data
 * @returns {Promise<Object>} The created blocker
 */
export async function createBlocker(blockerData) {
    if (!blockerData) {
        throw new Error('Missing blockerData');
    }

    const response = await fetch(`${API_URL}/api/blockers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(blockerData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Update a blocker
 * @param {string} blockerId - The blocker ID
 * @param {Object} updates - The fields to update
 * @returns {Promise<Object>} The updated blocker
 */
export async function updateBlocker(blockerId, updates) {
    if (!blockerId) {
        throw new Error('Missing blockerId');
    }

    const response = await fetch(`${API_URL}/api/blockers/${blockerId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Delete a blocker
 * @param {string} blockerId - The blocker ID
 * @returns {Promise<Object>} Response from deletion
 */
export async function deleteBlocker(blockerId) {
    if (!blockerId) {
        throw new Error('Missing blockerId');
    }

    const response = await fetch(`${API_URL}/api/blockers/${blockerId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Prepare for an upcoming meeting using AI
 * @param {string} userId - The user ID
 * @param {Object} meetingData - The meeting data including title, start, end, description, attendees
 * @param {Object} relatedContext - Optional related context (tasks, messages, etc.)
 * @returns {Promise<Object>} Response with conversationId and conversationUrl
 *   conversationUrl will be in format: /app/chat?conversation={conversationId}
 */
export async function prepareMeeting(userId, meetingData, relatedContext = {}) {
    if (!userId) {
        throw new Error('Missing userId');
    }

    if (!meetingData || typeof meetingData.title !== 'string' || !meetingData.title.trim()) {
        console.error('Invalid meetingData:', meetingData);
        throw new Error('Invalid meeting data - missing or invalid title');
    }

    console.log('Calling prepare-meeting API with:', { userId, meetingTitle: meetingData.title });

    const response = await fetch(`${API_URL}/api/agent/prepare-meeting`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId,
            meetingData,
            relatedContext
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Meeting prep result:', result);
    return result;
}
