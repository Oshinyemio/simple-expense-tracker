# 💰 Simple Expense Tracker

A fully serverless personal expense tracker built using AWS services. Users can log, retrieve, and manage expenses through a clean and secure API.

---

## 🛠 Tech Stack

- **AWS Lambda**
- **Amazon API Gateway**
- **Amazon DynamoDB**
- **Amazon S3** (for frontend hosting)
- **JavaScript** (frontend)
- **Python/Node.js** (Lambda backend logic)

---

## 🚀 Features

- Add and retrieve expenses via RESTful API
- Serverless architecture (scalable + cost-effective)
- Data persistence with DynamoDB
- Frontend hosted via S3 (optional)
- Organized by `userId` to simulate multi-user structure (hardcoded for now)

---

## 📂 Project Structure

simple-expense-tracker/\
├── frontend/\
│ ├── index.html\
│ └── app.js\
├── backend/\
│ ├── createExpense.js\
│ └── getExpenses.js\
└── infrastructure/\
└── api-gateway-config.yaml


---

## 🧪 How to Use

1. Deploy backend functions using AWS Lambda
2. Create API routes in API Gateway (POST /expenses, GET /expenses)
3. Connect DynamoDB table (with partition key: `userId`)
4. (Optional) Upload frontend to S3 bucket for static hosting

---

## 🌱 Future Improvements

- Add user authentication via Amazon Cognito
- Enable file upload (e.g., receipts)
- Add QuickSight integration for visual analytics
- Refactor to support multiple users securely

---

## 📜 License

This project is licensed under the MIT License.
