import json
import boto3
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Expenses')

def lambda_handler(event, context):
    print("Received event:", event)

    try:
        body = json.loads(event['body'])

        user_id = body['userId']
        amount = Decimal(str(body['amount']))  # wrap in str to avoid Decimal issues
        category = body['category']
        description = body.get('description', '')
        timestamp = datetime.utcnow().isoformat()

        item = {
            'userId': user_id,
            'timestamp': timestamp,
            'amount': amount,
            'category': category,
            'description': description
        }

        table.put_item(Item=item)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'message': 'Expense added successfully'})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
