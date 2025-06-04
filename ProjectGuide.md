# Project Guide: Serverless Personal Expense Tracker

This document provides a detailed, step-by-step guide on how the Serverless Personal Expense Tracker was built on AWS. It covers service choices, configuration details, challenges encountered, and solutions implemented. Use this as a comprehensive reference separate from the README.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Service Selection and Motivations](#service-selection-and-motivations)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Build Process](#step-by-step-build-process)

   1. [Create DynamoDB Table](#1-create-dynamodb-table)
   2. [Create Lambda Functions](#2-create-lambda-functions)

      * [AddExpenseFunction (POST)](#21-addexpensefunction-post)
      * [GetExpensesFunction (GET)](#22-getexpensesfunction-get)
   3. [Configure API Gateway](#3-configure-api-gateway)
   4. [Host Frontend on S3 + CloudFront (Optional)](#4-host-frontend-on-s3--cloudfront-optional)
   5. [Static Frontend (Single-User Model)](#5-static-frontend-single-user-model)
   6. [Multi-User Frontend](#6-multi-user-frontend)
5. [Common Challenges & Solutions](#common-challenges--solutions)
6. [Next Steps & Future Improvements](#next-steps--future-improvements)

---

## Introduction

This Serverless Personal Expense Tracker allows users to add and view their personal expenses without managing servers. By leveraging AWS Lambda, API Gateway, and DynamoDB, the application remains cost-effective, scalable, and easy to maintain. This guide details every step, from service choices to troubleshooting, to help you understand exactly how it all fits together.

---

## Service Selection and Motivations

**1. Amazon DynamoDB**

* **Why?** NoSQL, serverless, auto-scaling, and Free Tier eligible. Perfect for storing expense records without schema restrictions.
* **Key Points**: On-Demand billing mode (no capacity planning), composite primary key (`userId` + `timestamp`) for grouping and sorting.

**2. AWS Lambda**

* **Why?** Serverless compute that only bills per request/compute time. No need to manage servers.
* **Key Points**: Used for backend logic (POST `/expenses` and GET `/expenses`), automatically scales with usage.

**3. Amazon API Gateway**

* **Why?** Managed REST API front door that integrates seamlessly with Lambda (proxy integration), handles CORS, rate limiting, and can scale automatically.
* **Key Points**: Exposes secure HTTPS endpoints for the frontend to interact with Lambda.

**4. Amazon S3 + CloudFront**

* **Why?** Simple, cost-effective static website hosting. CloudFront adds HTTPS and global distribution.
* **Key Points**: Hosts the HTML/CSS/JavaScript frontend, allowing users to interact with the API.

**5. Amazon Cognito (Future)**

* **Why?** To replace manual `userId` entry with secure, authenticated identities.
* **Key Points**: Simplifies user login/signup, issues JWTs, integrates with API Gateway authorizers.

---

## Prerequisites

* **AWS Account** with permissions to create:

  * DynamoDB tables
  * Lambda functions
  * API Gateway REST APIs
  * IAM Roles/Policies
  * (Optional) S3 buckets and CloudFront distributions
* **AWS CLI** (optional, for local testing/deployment)
* **Basic knowledge** of:

  * JavaScript, HTML, CSS (frontend)
  * Python (backend Lambda)
  * AWS Console (IAM, DynamoDB, Lambda, API Gateway)

---

## Step-by-Step Build Process

### 1. Create DynamoDB Table

1. **Go to**: AWS Console → DynamoDB → Tables → **Create table**.
2. **Table name**: `Expenses`
3. **Primary key**:

   * Partition key: `userId` (String)
   * Sort key: `timestamp` (String)
4. **Billing Mode**: Select **On-Demand**.

   * No need to provision RCU/WCU; automatically scales. Free Tier covers up to 25M read/write per month.
5. **Secondary Indexes**: Skip for prototype (we'll use scan + filter in Lambda). For production, consider a GSI on `userId`.
6. **Create** and wait until the status is **Active**.

> **Result**: A table storing items like:
>
> ```json
> {
>   "userId": "user1",
>   "timestamp": "2025-06-02T00:38:22.768996",
>   "amount": 10.0,
>   "category": "Food",
>   "description": ""
> }
> ```

---

### 2. Create Lambda Functions

We need two Lambdas:

* **AddExpenseFunction** (POST `/expenses`)
* **GetExpensesFunction** (GET `/expenses?userId=XYZ`)

#### 2.1. AddExpenseFunction (POST)

1. **Navigate**: AWS Console → Lambda → **Create function**.
2. **Function name**: `AddExpenseFunction`
3. **Runtime**: Python 3.12
4. **Execution Role**: Create new role with basic Lambda permissions.
5. **Lambda Code**:

   ```python
   import json
   import boto3
   from datetime import datetime
   from decimal import Decimal

   dynamodb = boto3.resource('dynamodb')
   table = dynamodb.Table('Expenses')

   class DecimalEncoder(json.JSONEncoder):
       def default(self, o):
           if isinstance(o, Decimal):
               return float(o)
           return super(DecimalEncoder, self).default(o)

   def lambda_handler(event, context):
       print("🚀 Event received:", json.dumps(event))

       method = event.get('httpMethod', 'POST')
       if method != 'POST':
           return {
               'statusCode': 405,
               'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
               'body': json.dumps({'error': 'Method not allowed'})
           }

       try:
           body = json.loads(event.get('body', '{}'))
           print("📥 POST body:", body)

           user_id = body.get('userId')
           if not user_id:
               raise ValueError("Missing required field: userId")

           amount = Decimal(str(body.get('amount', 0)))
           category = body.get('category')
           description = body.get('description', '')
           timestamp = datetime.utcnow().isoformat()

           item = {
               'userId': user_id,
               'timestamp': timestamp,
               'amount': amount,
               'category': category,
               'description': description
           }
           print("💾 Saving item:", item)

           table.put_item(Item=item)

           response = {
               'statusCode': 200,
               'headers': {
                   'Content-Type': 'application/json',
                   'Access-Control-Allow-Origin': '*'
               },
               'body': json.dumps({'message': 'Expense added successfully'})
           }
           print("✅ POST response:", response)
           return response

       except Exception as e:
           print("❌ POST error:", str(e))
           return {
               'statusCode': 400,
               'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
               'body': json.dumps({'error': str(e)})
           }
   ```
6. **Attach DynamoDB permissions**:

   * Go to **Configuration → Permissions → Execution role**.
   * Click the role name → **Add permissions → Attach policies** → search for **AmazonDynamoDBFullAccess** (or custom policy granting `PutItem` on `Expenses` table).
7. **Deploy** the function.
8. **Test**:

   * Create a test event with:

     ```json
     {
       "httpMethod": "POST",
       "body": "{\"userId\":\"user1\",\"amount\":12.34,\"category\":\"Food\",\"description\":\"Lunch\"}"
     }
     ```
   * Check CloudWatch logs for "Saving item" and verify the item in DynamoDB.

#### 2.2. GetExpensesFunction (GET)

1. **Navigate**: AWS Console → Lambda → **Create function**.
2. **Function name**: `GetExpensesFunction`
3. **Runtime**: Python 3.12
4. **Execution Role**: (reuse the same or a new role with read permissions).
5. **Lambda Code**:

   ```python
   import json
   import boto3
   from decimal import Decimal

   dynamodb = boto3.resource('dynamodb')
   table = dynamodb.Table('Expenses')

   class DecimalEncoder(json.JSONEncoder):
       def default(self, o):
           if isinstance(o, Decimal):
               return float(o)
           return super(DecimalEncoder, self).default(o)

   def lambda_handler(event, context):
       print("🚀 Event received:", json.dumps(event))
       method = event.get('httpMethod', 'GET')

       if method != 'GET':
           return {
               'statusCode': 405,
               'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
               'body': json.dumps({'error': 'Method not allowed'})
           }

       try:
           params = event.get('queryStringParameters') or {}
           user_id = params.get('userId')
           print("📌 Extracted userId:", user_id)

           if not user_id:
               raise ValueError("Missing required field: userId")

           response = table.scan()
           items = response.get('Items', [])
           print(f"📦 Scanned {len(items)} items from DB")

           user_expenses = [item for item in items if item.get('userId') == user_id]
           print(f"✅ Filtered to {len(user_expenses)} expenses for user '{user_id}'")

           return {
               'statusCode': 200,
               'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
               'body': json.dumps({'expenses': user_expenses}, cls=DecimalEncoder)
           }

       except Exception as e:
           print("❌ GET error:", str(e))
           return {
               'statusCode': 400,
               'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
               'body': json.dumps({'error': str(e)})
           }
   ```
6. **Attach DynamoDB read permissions**:

   * In IAM role, attach **AmazonDynamoDBReadOnlyAccess** (or a custom policy for `Scan` on `Expenses`).
7. **Deploy** and **Test**:

   * Use test event:

     ```json
     {
       "httpMethod": "GET",
       "queryStringParameters": { "userId": "user1" }
     }
     ```
   * Verify CloudWatch prints scanned items and filtered expenses.

---

### 3. Configure API Gateway

#### 3.1. Create REST API

1. Go to **API Gateway → Create API → REST API → Build**.
2. **API name**: `ExpenseTrackerAPI`.
3. Click **Create API**.

#### 3.2. Create `/expenses` Resource

1. In the **Resources** panel, click **Actions → Create Resource**.
2. **Resource Name**: `expenses` (path `/expenses`).
3. Click **Create Resource**.

#### 3.3. Configure POST /expenses

1. Select `/expenses` → **Actions → Create Method → POST → ✔**.
2. **Integration Type**: Lambda Proxy → **Lambda Function**: `AddExpenseFunction` → **Save**.
3. **Enable CORS**: Select POST → **Actions → Enable CORS** → **Enable CORS and replace existing CORS headers**.

#### 3.4. Configure GET /expenses

1. Select `/expenses` → **Actions → Create Method → GET → ✔**.
2. **Integration Type**: Lambda Proxy → **Lambda Function**: `GetExpensesFunction` → **Save**.
3. **Enable CORS** on GET as well.

#### 3.5. Deploy API

1. **Actions → Deploy API**.
2. **Deployment stage**: `[New Stage]` → `prod` → **Deploy**.
3. Copy **Invoke URL**:

   ```
   https://{api-id}.execute-api.{region}.amazonaws.com/prod
   ```
4. **Endpoints**:

   * **POST**: `https://{api-id}.execute-api.{region}.amazonaws.com/prod/expenses`
   * **GET**: `https://{api-id}.execute-api.{region}.amazonaws.com/prod/expenses?userId=user1`

---

### 4. Host Frontend on S3 + CloudFront (Optional)

1. **S3**:

   * Create a bucket (e.g., `expense-tracker-frontend`).
   * Enable **Static website hosting** with index document `index.html`.
   * Upload the HTML file.
   * Configure bucket policy or object ACL for public read.
   * Note the **Website Endpoint** (e.g., `http://expense-tracker-frontend.s3-website-us-east-1.amazonaws.com`).

2. **CloudFront** (optional):

   * Create a CloudFront distribution with the S3 website endpoint as the origin.
   * Configure default cache behavior (HTTPS redirect, GET/HEAD only).
   * Use the distribution domain (e.g., `d123abc.cloudfront.net`) as your website URL.

---

### 5. Static Frontend (Single-User Model)

Below is the working HTML/JS for the version where `userId` is hardcoded to `user1`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Personal Expense Tracker (Static user)</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; }
    input, button { padding: 8px; margin: 6px 0; width: 100%; }
    form { border: 1px solid #ccc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    #response { font-weight: bold; }
    ul { list-style-type: none; padding: 0; }
    li { background: #f9f9f9; padding: 10px; margin-bottom: 6px; border-radius: 4px; }
  </style>
</head>
<body>

  <h2>Submit a New Expense</h2>
  <form id="expenseForm">
    <label>Amount:</label>
    <input name="amount" type="number" step="0.01" required>

    <label>Category:</label>
    <input name="category" required>

    <label>Description (optional):</label>
    <input name="description">

    <button type="submit">Add Expense</button>
  </form>

  <p id="response"></p>

  <h3>All Expenses</h3>
  <button onclick="loadExpenses()">Refresh</button>
  <ul id="expenseList">Loading...</ul>

  <script>
    const apiBaseUrl = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod/expenses';
    const staticUserId = "user1";

    document.getElementById('expenseForm').onsubmit = async function(e) {
      e.preventDefault();

      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      data.userId = staticUserId;

      try {
        const res = await fetch(apiBaseUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await res.json();
        console.log("✅ POST response:", result);

        if (res.ok) {
          document.getElementById('response').innerText = result.message || 'Expense added successfully!';
          document.getElementById('response').style.color = 'green';
          e.target.reset();
          loadExpenses();
        } else {
          document.getElementById('response').innerText = result.error || 'Error occurred';
          document.getElementById('response').style.color = 'red';
        }
      } catch (err) {
        document.getElementById('response').innerText = 'Network error or invalid response';
        document.getElementById('response').style.color = 'red';
        console.error(err);
      }
    };

    async function loadExpenses() {
      const list = document.getElementById('expenseList');
      list.innerHTML = 'Loading...';

      try {
        const url = `${apiBaseUrl}?userId=${staticUserId}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("📥 GET response data:", data);

        list.innerHTML = '';
        if (data.expenses && data.expenses.length > 0) {
          data.expenses.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          data.expenses.forEach(exp => {
            const item = document.createElement('li');
            item.textContent = `${exp.category}: $${exp.amount} — ${exp.description || ''} (${new Date(exp.timestamp).toLocaleString()})`;
            list.appendChild(item);
          });
        } else {
          list.innerHTML = '<li>No expenses found.</li>';
        }
      } catch (err) {
        list.innerHTML = '<li>Error loading expenses.</li>';
        console.error(err);
      }
    }

    window.onload = loadExpenses;
  </script>

</body>
</html>
```

---

### 6. Common Challenges & Solutions

**Challenge 1: CORS Errors**

* **Symptom:** Browser console blocks the fetch: “Access to fetch at … from origin ‘null’ has been blocked by CORS policy.”
* **Cause:** API Gateway or Lambda not including `Access-Control-Allow-Origin` header.
* **Solution:**

  1. In API Gateway, enable CORS for both POST and GET (Actions → Enable CORS).
  2. In each Lambda response, include:

     ```python
     'headers': {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*'
     }
     ```
  3. Redeploy API.

**Challenge 2: Decimal JSON Serialization Error**

* **Symptom:** Lambda GET returns: “Object of type Decimal is not JSON serializable.”
* **Cause:** DynamoDB stores numbers as `Decimal`; `json.dumps()` cannot encode directly.
* **Solution:** Add a custom encoder:

  ```python
  class DecimalEncoder(json.JSONEncoder):
      def default(self, o):
          if isinstance(o, Decimal):
              return float(o)
          return super(DecimalEncoder, self).default(o)
  # Then use:
  'body': json.dumps({'expenses': user_expenses}, cls=DecimalEncoder)
  ```

**Challenge 3: Missing userId in GET**

* **Symptom:** Calling GET with `?userId=user1` still returns 400 “Missing required field: userId.”
* **Cause:** API Gateway not forwarding query params to Lambda.
* **Solution:**

  1. In API Gateway → GET method → Integration Request → Mapping Templates → `application/json` →

     ```velocity
     {
       "httpMethod": "$context.httpMethod",
       "queryStringParameters": {
         #foreach($param in $input.params().querystring.keySet())
           "$param": "$util.escapeJavaScript($input.params().querystring.get($param))"
           #if($foreach.hasNext),#end
         #end
       },
       "body": $input.body
     }
     ```
  2. Save and **Deploy**.

**Challenge 4: expenses array undefined in Frontend**

* **Symptom:** Frontend’s `data.expenses` is undefined even though API returns 200.
* **Cause:** Lambda Proxy Integration wraps the response; `body` is a stringified JSON. Doing `res.json()` yields an object with `body` as a string.
* **Solution:**

  ```js
  const text = await res.text();
  const data = JSON.parse(text);
  // Now data.expenses is valid.
  ```

**Challenge 5: IAM AccessDenied for DynamoDB**

* **Symptom:** Lambda logs show `AccessDeniedException: not authorized to perform: dynamodb:Scan`.
* **Cause:** Lambda’s execution role lacks required DynamoDB permissions.
* **Solution:**

  * In IAM → Roles → select your Lambda role → Attach policy **AmazonDynamoDBReadOnlyAccess** for GET or **AmazonDynamoDBFullAccess** (or scoped policy) for POST.

---

## Next Steps & Future Improvements

1. **Add Authentication with Amazon Cognito**

   * Replace manual `userId` with Cognito identity (Cognito User Pool).
   * Use a Cognito Authorizer in API Gateway so that requests carry a JWT and Lambda extracts `userId` from the token.
   * This ensures secure, real multi-user separation, preventing data spoofing.

2. **Optimize Data Access**

   * Switch from `Scan` + filter to a DynamoDB Query on the partition key (`userId`).
   * Consider a Global Secondary Index (e.g., partition on `userId`, sort by `timestamp`) for faster queries.

3. **Pagination & Sorting**

   * Implement pagination (limit + `LastEvaluatedKey`) in GET handler.
   * Allow sorting or filtering by category or date range in the backend.

4. **Frontend Enhancements**

   * Use a modern framework (React, Vue, Angular) for a more dynamic, component-based UI.
   * Add form validation, inline editing, and delete functionality.
   * Create summary cards (e.g., total spent this month, category breakdown).
   * Visualize expense trends with charts (Chart.js, Recharts, or Amazon QuickSight).

5. **Reporting & Analytics**

   * Export expenses to CSV from the frontend.
   * Use Amazon QuickSight on DynamoDB (via Athena or S3 export) to build dashboards.

6. **CI/CD & Infrastructure as Code**

   * Automate deployments with AWS SAM, CloudFormation, or Terraform.
   * Use AWS CodePipeline or GitHub Actions to deploy changes to Lambda, API Gateway, and S3 on push.

---

## Repository Structure

```
expense-tracker/
├── frontend/
│   ├── index.html             # Static frontend (single-user or multi-user version)
│   └── (assets, CSS, JS if separated)
├── lambda/
│   ├── AddExpenseFunction.py  # Lambda code for POST /expenses
│   └── GetExpensesFunction.py # Lambda code for GET /expenses
├── PROJECT_GUIDE.md           # This detailed step-by-step guide
├── README.md                  # Summary, quickstart, architecture
└── LICENSE                    # MIT License or similar
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
