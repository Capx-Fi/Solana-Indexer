import json
import os
import boto3
import asyncio
import requests
import base64
from datetime import datetime
from boto3.dynamodb.conditions import Key



def fetch_project_overview(userAddress) :
    print(userAddress)
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['DERIVATIVE_TABLENAME'])
    derivativeItems = table.scan()["Items"]


    projectOwnerData = []
    WrappedProjectDetails = []

    
    validProjectIDs = []

    for derivativeItem in derivativeItems:
        if(derivativeItem["associatedprojectID"] in validProjectIDs):
            pass
        else :
            balanceResponse = requests.post("https://api.devnet.solana.com/",json={"jsonrpc": "2.0","id": 1,"method": "getTokenAccountsByOwner","params": [userAddress,{"mint": derivativeItem["derivativeID"]},{"encoding": "jsonParsed"}]})
            balanceResponse = (balanceResponse.json())
            print(balanceResponse)
            if (('error' not in balanceResponse) and balanceResponse["result"]["value"][0]["account"]["data"]["parsed"]["info"]["tokenAmount"]["uiAmount"] != 0):
                validProjectIDs.append(derivativeItem["associatedprojectID"])
    
    table = dynamodb.Table(os.environ['PROJECT_TABLENAME'])
    projectItems = table.scan()["Items"]
    print(projectItems)


    for projectItem in projectItems :
        if (projectItem["owner"] == userAddress or projectItem["projectID"] in validProjectIDs) :
            response1 = requests.post("https://api.devnet.solana.com/",json={"jsonrpc":"2.0", "id":1, "method":"getTokenLargestAccounts", "params": [projectItem["projectID"]]})
            response1 = (response1.json())
            if ('error' not in response1) :
                projectOwnerData.append(
                    {
                        "__typename" : "Project",
                        "id" : projectItem["projectID"],
                        "projectName" : projectItem["Item"]["projectName"],
                        "projectTokenAddress": projectItem["Item"]["projectID"],
                        "projectOwnerAddress" : projectItem["Item"]["owner"],
                        "projectTokenDecimal" : projectItem["decimal"],
                        "projectTokenTicker" : None,
                        "projectDocHash" : projectItem["projectHash"],
                    }
                )
                derivativesTemp = []
                for derivativeItem in derivativeItems :
                    if (derivativeItem["associatedprojectID"] == projectItem["projectID"]) :
                        response2 = requests.post("https://api.devnet.solana.com/",json={"jsonrpc":"2.0", "id":1, "method":"getTokenLargestAccounts", "params": [derivativeItem["derivativeID"]]})
                        response2 = (response2.json())
                        if ('error' not in response2) :
                            holdersTemp = []
                            for holder in response2["result"]["value"] :
                                holdersTemp.append(
                                    {
                                        "__typename": "UserHoldings",
                                        "tokenAmount": holder["amount"],
                                        "address": holder["account"],
                                    }
                                )
                            derivativesTemp.append(
                                {
                                    "__typename" : "Derivative",
                                    "id" : derivativeItem["derivativeID"],
                                    "unlockTime" : derivativeItem["derivativeUnlockTime"],
                                    "totalSupply" : derivativeItem["derivativeTotalSupply"],
                                    "wrappedTokenTicker": None,
                                    "holders" : holdersTemp,
                                }
                            )
                
                WrappedProjectDetails.append(
                    {
                        "__typename" : "Project",
                        "id" : projectItem["projectID"],
                        "derivatives": derivativesTemp,
                    }
                )
    return [projectOwnerData, WrappedProjectDetails , [{}] * len(projectOwnerData)]
    

def fetch_investor_dashboard(userAddress) :
    print(userAddress)
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['DERIVATIVE_TABLENAME'])
    items = table.scan()["Items"]
    projectIDs = []
    returnList = []
    for item in items :
        if(item["associatedprojectID"] in projectIDs):
            pass
        else :
            balanceResponse = requests.post("https://api.devnet.solana.com/",json={"jsonrpc": "2.0","id": 1,"method": "getTokenAccountsByOwner","params": [userAddress,{"mint": item["derivativeID"]},{"encoding": "jsonParsed"}]})
            balanceResponse = (balanceResponse.json())
            print(balanceResponse)
            if ('error' not in balanceResponse and balanceResponse["result"]["value"][0]["account"]["data"]["parsed"]["info"]["tokenAmount"]["uiAmount"] != 0):
                balanceResponse = balanceResponse["result"]["value"][0]["account"]["data"]["parsed"]["info"]["tokenAmount"]
                projectTable = dynamodb.Table(os.environ['PROJECT_TABLENAME'])
                projectItem = projectTable.get_item(Key={"projectID": item["associatedprojectID"]})
                dt_object = datetime.fromtimestamp(item["derivativeUnlockTime"])

                returnList.append(
                    {
                        "date" : str(dt_object.year) + "-" + str(dt_object.month) + "-" + str(dt_object.day) + "T" + str(dt_object.hour) + ":" + str(dt_object.minute) + ":" + str(dt_object.second) + ".000Z",
                        "displayDate" : str(dt_object.day) + " " + dt_object.strftime("%B") + ", " + str(dt_object.year),
                        "unlockDate" : str(dt_object.month) + "/" + str(dt_object.day) + "/" + str(dt_object.year),
                        "projectName" : projectItem["Item"]["projectName"],
                        "projectTokenAddress": projectItem["Item"]["projectID"],
                        "projectOwnerAddress" : projectItem["Item"]["owner"],
                        "derivativeID": item["derivativeID"],
                        "numOfTokens" : balanceResponse["uiAmount"],
                        "tokenAmount" : balanceResponse["amount"],
                        "withdrawAllowed" : datetime.now().timestamp >= dt_object.timestamp,
                        "holderAddress" : userAddress,
                        "vestID" : None,
                        "projectTokenDecimal" : balanceResponse["decimal"],
                        "projectTokenTicker" : None,
                        "wrappedTokenTicker": None,
                    }
                )
    print(returnList)
    return returnList

def fetch_project_exists(projectID) :
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['PROJECT_TABLENAME'])
    fe = Key('projectID').eq(projectID)
    projectItems = table.scan(FilterExpression=fe)["Items"]
    for item in projectItems :
        return (
            {
                "data" : {
                    "projectID" : item["projectID"],
                    "projectName" : item["projectName"],
                    "projectHash" : item["projectHash"]
                },
                "status" : True
            })
    return {
        "status" : False,
        "data" : {}
    }

                



def lambda_handler(event, context):
    if (event["rawPath"] == "/investorDashboard"):
        return {
        'statusCode': 200,
        'body': (fetch_investor_dashboard(event["queryStringParameters"]["user"]))
    }
    elif (event["rawPath"] == "/projectOverview"):
        return {
        'statusCode': 200,
        'body': (fetch_project_overview(event["queryStringParameters"]["user"]))
    }
    elif (event["rawPath"] == "/checkProject"):
        return {
        'statusCode': 200,
        'body': (fetch_project_exists(event["queryStringParameters"]["projectID"]))
    }

