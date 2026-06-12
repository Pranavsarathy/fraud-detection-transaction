let analyticsChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    // --- Initial Data Fetch ---
    fetchAnalytics();
    fetchTransactions();

    // --- Navigation Logic ---
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.page-section');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            link.classList.add('active');

            // Hide all sections
            sections.forEach(sec => {
                sec.classList.remove('active');
                sec.classList.add('hidden');
            });

            // Show target section
            const targetId = link.getAttribute('data-target');
            const targetSection = document.getElementById(`section-${targetId}`);
            
            if (targetSection) {
                targetSection.classList.remove('hidden');
                setTimeout(() => {
                    targetSection.classList.add('active');
                }, 10);
            }
        });
    });

    // --- Scanner Logic ---
    const form = document.getElementById("transactionForm");
    const scanBtn = document.getElementById("scanBtn");
    
    const emptyState = document.getElementById("emptyState");
    const resultData = document.getElementById("resultData");
    
    const scorePath = document.getElementById("scorePath");
    const scoreText = document.getElementById("scoreText");
    const resultStatus = document.getElementById("resultStatus");
    const resultMessage = document.getElementById("resultMessage");
    const riskBadge = document.getElementById("riskBadge");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // UI Loading state
            const originalBtnText = scanBtn.innerHTML;
            scanBtn.innerHTML = `<span class="material-symbols-outlined spin" style="animation: spin 1s linear infinite;">refresh</span> Analyzing...`;
            scanBtn.disabled = true;

            const styleSheet = document.createElement("style");
            styleSheet.innerText = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(styleSheet);

            const payload = {
                amount: parseFloat(document.getElementById("amount").value),
                account_age_days: parseInt(document.getElementById("account_age").value),
                location: document.getElementById("location").value,
                time_of_day: document.getElementById("time_of_day").value,
                merchant_category: document.getElementById("merchant").value
            };

            try {
                const response = await fetch("/api/analyze-transaction", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error("Network response was not ok");

                const data = await response.json();
                const result = data.data;

                // Show results UI
                emptyState.classList.add("hidden");
                resultData.classList.remove("hidden");

                // Update UI with animation
                animateResults(result);

                // REFRESH DATA in background so tables/charts are up to date
                fetchAnalytics();
                fetchTransactions();

            } catch (error) {
                console.error("Error analyzing transaction:", error);
                alert("Error connecting to the analysis engine. Make sure the backend is running.");
            } finally {
                scanBtn.innerHTML = originalBtnText;
                scanBtn.disabled = false;
            }
        });
    }

    function animateResults(result) {
        scorePath.className.baseVal = "circle";
        resultStatus.className = "";
        riskBadge.className = "risk-badge";

        const scorePercentage = Math.round(result.fraud_score * 100);
        
        setTimeout(() => {
            scorePath.setAttribute("stroke-dasharray", `${scorePercentage}, 100`);
            
            let start = 0;
            const duration = 1000;
            const increment = scorePercentage / (duration / 16);
            
            const counter = setInterval(() => {
                start += increment;
                if(start >= scorePercentage) {
                    start = scorePercentage;
                    clearInterval(counter);
                }
                scoreText.textContent = `${Math.round(start)}%`;
            }, 16);
            
        }, 100);

        if (result.is_fraudulent) {
            scorePath.classList.add("stroke-danger");
            resultStatus.classList.add("status-danger");
            resultStatus.textContent = "Fraud Detected";
            riskBadge.classList.add("bg-danger");
            riskBadge.textContent = "High Risk";
        } else if (result.fraud_score > 0.3) {
            scorePath.classList.add("stroke-warning");
            resultStatus.classList.add("status-warning");
            resultStatus.textContent = "Suspicious Activity";
            riskBadge.classList.add("bg-warning");
            riskBadge.textContent = "Medium Risk";
        } else {
            scorePath.classList.add("stroke-safe");
            resultStatus.classList.add("status-safe");
            resultStatus.textContent = "Safe Transaction";
            riskBadge.classList.add("bg-safe");
            riskBadge.textContent = "Low Risk";
        }

        resultMessage.textContent = result.message;
    }
});

// --- API Fetching Functions ---

window.fetchAnalytics = async function() {
    try {
        const res = await fetch('/api/analytics');
        const json = await res.json();
        const data = json.data;

        // Update Dashboard Stats
        document.getElementById('statScanned').innerText = data.total_scanned.toLocaleString();
        document.getElementById('statBlocked').innerText = data.threats_blocked.toLocaleString();
        document.getElementById('statAccuracy').innerText = data.system_accuracy;

        // Render Chart.js
        renderChart(data.chart_data);
    } catch (err) {
        console.error("Failed to fetch analytics", err);
    }
}

window.fetchTransactions = async function() {
    try {
        const res = await fetch('/api/transactions');
        const json = await res.json();
        const data = json.data;

        const tbody = document.getElementById('transactionsTableBody');
        tbody.innerHTML = ''; // clear loading state

        data.forEach(tx => {
            const tr = document.createElement('tr');
            
            // formatting
            let badgeClass = 'safe';
            if(tx.risk_level === 'High') badgeClass = 'danger';
            if(tx.risk_level === 'Medium') badgeClass = 'warning';

            tr.innerHTML = `
                <td>#${tx.tx_id}</td>
                <td>$${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>${tx.location}</td>
                <td>${tx.time_of_day}</td>
                <td><span class="status-badge ${badgeClass}">${tx.risk_level} Risk</span></td>
                <td><button class="btn-text">View</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Failed to fetch transactions", err);
    }
}

function renderChart(chartData) {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    
    if (analyticsChartInstance) {
        analyticsChartInstance.destroy();
    }

    analyticsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Safe Volume',
                    data: chartData.safe_volume,
                    backgroundColor: '#3b82f6', // accent-primary
                    borderRadius: 4,
                },
                {
                    label: 'Fraud Threats',
                    data: chartData.fraud_volume,
                    backgroundColor: '#ef4444', // status-danger
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ba1a6' }
                },
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ba1a6' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f0f2f5' }
                }
            }
        }
    });
}
