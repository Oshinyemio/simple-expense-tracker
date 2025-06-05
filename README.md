# 💰 Simple Expense Tracker

A fully serverless personal expense tracker built using AWS services. Users can log and retrieve expenses through a clean and secure API. This project demonstrates a foundational serverless architecture leveraging AWS Lambda, API Gateway, and DynamoDB.

---

## 🛠 Tech Stack

- **AWS Lambda**
- **Amazon API Gateway**
- **Amazon DynamoDB**
- **Amazon S3**
- **JavaScript**
- **Python** 

---

## 🚀 Features

- Add new expenses and retrieve expense lists via API
- Serverless architecture for scalability and cost efficiency
- Data persisted in DynamoDB using `userId` as partition key (currently hardcoded)
- Frontend static site for user interaction
- Single Lambda function handling both creation and retrieval of expenses

---

## 📂 Project Structure

- simple-expense-tracker
  - frontend
    - index.html
    - app.js          # Frontend logic calling the API
  - backend
    - expenses.js     # Single Lambda function handling all expense operations
  - infrastructure
    - api-gateway-config.yaml  # API Gateway configuration files



---


---

## 🚀 How to Run and Deploy

### Local Testing

- The frontend is a simple static website (`frontend/index.html`) that can be opened in any browser.
- Since the frontend calls AWS APIs, backend must be deployed or you need API mocks for full local testing.

### Deploy Backend

1. Create a DynamoDB table named `Expenses` with partition key `userId`.
2. Deploy the single Lambda function (`backend/expenses.js`) to AWS Lambda.
3. Create API Gateway REST API with endpoints:
   - POST `/expenses` → linked to Lambda function
   - GET `/expenses` → linked to the same Lambda function (routing based on HTTP method)
4. Configure IAM roles and permissions allowing Lambda to access DynamoDB.
5. Set the environment variable `EXPENSES_TABLE` in the Lambda function to your DynamoDB table name.

### Host Frontend

- Upload contents of `frontend/` folder to an S3 bucket configured for static website hosting.
- Update `app.js` to point API requests to your deployed API Gateway URL.

### Notes

- Currently, `userId` is hardcoded in the frontend for demonstration purposes.
- User authentication and multi-user support will be added in the advanced version.

## Screenshot

Here is what the Simple Expense Tracker looks like:

![Simple Expense Tracker](https://github.com/Oshinyemio/simple-expense-tracker/blob/main/assets/screenshot.png?raw=true)

---

## 📬 Contact

Ope – Aspiring Cloud Support Specialist  
[LinkedIn](https://linkedin.com/in/oshinyemio) | oshinyemio@gmail.com

---

## 📜 License

This project is licensed under the MIT License.

