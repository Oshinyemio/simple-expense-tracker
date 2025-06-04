import json
import boto3
from datetime import datetime
from decimal import Decimal
import uuid

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Expenses')

# Helper to handle Decimal values
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    print("📥 Event:", json.dumps(event))

    method = event.get('httpMethod', 'GET')

    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))

            expense = {
                'userId': body.get('userId', 'user1'),
                'timestamp': datetime.utcnow().isoformat(),
                'amount': Decimal(str(body.get('amount'))),
                'category': body.get('category', 'Other'),
                'description': body.get('description', ''),
                'id': str(uuid.uuid4())
            }

            table.put_item(Item=expense)

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'message': 'Expense added successfully'})
            }

        except Exception as e:
            print("❌ POST Error:", str(e))
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': str(e)})
            }

    elif method == 'GET':
        try:
            user_id = 'user1'
            if event.get('queryStringParameters') and event['queryStringParameters'].get('userId'):
                user_id = event['queryStringParameters']['userId']

            response = table.scan()
            items = response.get('Items', [])

            user_expenses = [item for item in items if item.get('userId') == user_id]

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'expenses': user_expenses}, cls=DecimalEncoder)
            }

        except Exception as e:
            print("❌ GET Error:", str(e))
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': str(e)})
            }

    else:
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }
