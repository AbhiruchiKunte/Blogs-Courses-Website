// /js/payment.js

const API_BASE_URL = ""; 
let currentUser = null; // Private variable to store user state

// Export a function to set the current user (called from index.html and dashboard.html)
export function setCurrentUser(user) {
    currentUser = user;
}

// Global helper to safely parse API responses (required by enrollNow)
export async function parseResponseSafely(response) {
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    try {
        if (ct.includes('application/json')) {
            return await response.json();
        } else {
            const txt = await response.text();
            try { return JSON.parse(txt); }
            catch (e) { return { success: false, message: txt || response.statusText }; }
        }
    } catch (err) {
        console.error('Error parsing response safely:', err);
        return { success: false, message: 'Unable to parse server response' };
    }
}

// Track View Helper (required by handleEnroll/handleAccess)
async function trackView(id, type) {
    if (!currentUser || !id) return;
    try {
        const token = await currentUser.getIdToken();
        // Fire and forget
        fetch('/api/users/track-view', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, id })
        }).catch(err => console.error("Tracking failed", err));
    } catch (e) {
        console.error("Tracking auth error", e);
    }
}

// Razorpay Logic (required by handleEnroll)
function enrollNow(coursename, price, link, courseId) {
    // price should be in rupees on UI; backend will multiply by 100
    fetch(`${API_BASE_URL}/createOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: price,
            name: coursename,
            description: 'Course Payment'
        })
    })
        .then(async (res) => {
            const data = await parseResponseSafely(res);
            if (!res.ok) {
                console.error('Order creation HTTP error:', res.status, data);
                alert(`Order creation failed: ${data.message || res.statusText}`);
                return null;
            }
            return data;
        })
        .then(data => {
            if (!data) return;
            if (data.success) {
                const options = {
                    key: data.key_id,
                    amount: data.amount,
                    currency: 'INR',
                    name: data.name,
                    description: data.description,
                    image: 'https://www.example.com/logo.png', // Replace with your logo
                    order_id: data.order_id,
                    handler: async function (response) {
                        // Verify Payment on Backend
                        try {
                            const verifyRes = await fetch(`${API_BASE_URL}/verify-payment`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    order_id: response.razorpay_order_id,
                                    payment_id: response.razorpay_payment_id,
                                    signature: response.razorpay_signature,
                                    course_name: data.name,
                                    course_id: courseId, 
                                    user_uid: currentUser ? currentUser.uid : null
                                })
                            });

                            const verifyData = await verifyRes.json();
                            if (verifyData.success) {
                                Toastify({
                                    text: "Payment Successful! Course Added. Redirecting...",
                                    duration: 3000,
                                    backgroundColor: "green",
                                }).showToast();
                                // Redirect to course link after successful verification
                                if (link) setTimeout(() => window.location.href = link, 1500);
                            } else {
                                Toastify({
                                    text: "Payment Verification Failed: " + verifyData.message,
                                    duration: 3000,
                                    backgroundColor: "red",
                                }).showToast();
                            }
                        } catch (err) {
                            console.error(err);
                            Toastify({
                                text: "Payment Verification Error",
                                duration: 3000,
                                backgroundColor: "red",
                            }).showToast();
                        }
                    },
                    prefill: {
                        name: currentUser?.displayName || data.name,
                        email: currentUser?.email || data.email,
                        contact: data.contact
                    },
                    notes: { address: 'SciAstra Blogs & Courses' },
                    theme: { color: '#0B192C' }
                };
                
                if (typeof Razorpay === 'undefined') {
                    console.error('Razorpay SDK not loaded!');
                    alert('Razorpay SDK failed to load. Please check your connection.');
                    return;
                }
                const rzp1 = new Razorpay(options);
                rzp1.on('payment.failed', function (response) {
                    console.error('Payment failed callback', response);
                    Toastify({
                        text: "Payment Failed. Please try again.",
                        duration: 3000,
                        backgroundColor: "red",
                    }).showToast();
                });
                rzp1.open();
            } else {
                alert(data.msg || data.message || 'Order creation failed. Please try again.');
            }
        })
        .catch(err => {
            console.error('Error in enrollNow:', err);
            Toastify({
                text: "Error creating order.",
                duration: 3000,
                backgroundColor: "red",
            }).showToast();
        });
}

/* ----------------------------------------------------
   GLOBAL EXPOSURE OF HANDLERS FOR HTML ONCLICK ATTRIBUTES
   ---------------------------------------------------- */

// Access Handler - Used by index.html for Blogs and Free Courses
window.handleAccess = function (url, id, type) {
    if (currentUser) {
        if (id && type) trackView(id, type);
        window.open(url, '_blank');
    } else {
        alert("Please login to access this content.");
        window.location.href = '/login.html';
    }
};

// Enroll Handler - Used by index.html for Paid Courses, initiates Razorpay
window.handleEnroll = function (name, price, link, id) {
    if (currentUser) {
        if (id) trackView(id, 'course');
        enrollNow(name, price, link, id);
    } else {
        alert("Please login to enroll.");
        window.location.href = '/login.html';
    }
};