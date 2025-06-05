import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Expenses')

def lambda_handler(event, context):
    print("🔍 Received event:", json.dumps(event))

    try:
        # Ensure queryStringParameters exists and includes userId
        query_params = event.get('queryStringParameters')
        if not query_params or 'userId' not in query_params:
            raise ValueError("Missing 'userId' in query parameters")

        user_id = query_params['userId']

        # Query DynamoDB for userId
        response = table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        expenses = response.get('Items', [])

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'expenses': expenses}, cls=DecimalEncoder)
        }

    except Exception as e:
        print("❌ Error:", str(e))
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
