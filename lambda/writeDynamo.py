import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')


def handle_new_project(data):
    table = dynamodb.Table(os.environ['PROJECT_TABLENAME'])
    response = table.put_item(
        Item={
            "projectID": data["tokenAddress"],
            "projectName": data["name"],
            "projectHash": data["description"],
            "owner": data["creator"],
            "decimal": data["decimal"],
        }
    )
    return response


def handle_create_new_token(data):
    table = dynamodb.Table(os.environ['DERIVATIVE_TABLENAME'])
    response = table.put_item(
        Item={
            "derivativeID": data["derivativeAddress"],
            "associatedprojectID": data["projectTokenAddress"],
            "derivativeUnlockTime": data["unlockTime"],
            "derivativeTotalSupply": 0,
        }
    )
    return response


def handle_token_mint(data):
    table = dynamodb.Table(os.environ['DERIVATIVE_TABLENAME'])
    response = table.update_item(
        Key={"derivativeID": data["derivativeAddress"]},
        UpdateExpression="SET derivativeTotalSupply = derivativeTotalSupply + :der",
        ExpressionAttributeValues={
            ":der": data["mintAmount"]
        }
    )


def handle_token_burn(data):
    table = dynamodb.Table(os.environ['DERIVATIVE_TABLENAME'])
    response = table.update_item(
        Key={"derivativeID": data["derivativeAddress"]},
        UpdateExpression="SET derivativeTotalSupply = derivativeTotalSupply - :der",
        ExpressionAttributeValues={
            ":der": data["burnAmount"]
        }
    )


def lambda_handler(event, context):
    responseList = []
    for record in event["Records"]:
        data = (json.loads(record["body"]))
        print(data)
        if (data["event"] == "Project"):
            responseList.append(handle_new_project(data))
        elif (data["event"] == "Derivative"):
            responseList.append(handle_create_new_token(data))
        elif (data["event"] == "Mint Derivative"):
            responseList.append(handle_token_mint(data))
        elif (data["event"] == "Burn Derivative"):
            responseList.append(handle_token_burn(data))

    return {
        'statusCode': 200,
        'body': json.dumps({
            "responses": responseList
        })
    }
