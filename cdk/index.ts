import {
  AuthorizationType,
  IResource,
  LambdaIntegration,
  MethodOptions,
  MockIntegration,
  PassthroughBehavior,
  RestApi,
} from "aws-cdk-lib/aws-apigateway"
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb"
import { Runtime } from "aws-cdk-lib/aws-lambda"
import { App, Stack, RemovalPolicy } from "aws-cdk-lib"
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs"
import { join } from "path"

export class ApiLambdaCrudDynamoDBStack extends Stack {
  constructor(app: App, id: string) {
    super(app, id)
    // Database
    const dynamoTable = new Table(this, "items", {
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      tableName: "items",
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          "aws-sdk", // Use the 'aws-sdk' available in the Lambda runtime
        ],
      },
      environment: {
        PRIMARY_KEY: "id",
        TABLE_NAME: dynamoTable.tableName,
      },
      runtime: Runtime.NODEJS_20_X,
    }
    // Lambda functions
    const getOneLambda = new NodejsFunction(this, "getOneItemFunction", {
      entry: join(__dirname, "..", "lambdas", "get-one.ts"),
      ...nodeJsFunctionProps,
    })
    const getAllLambda = new NodejsFunction(this, "getAllItemsFunction", {
      entry: join(__dirname, "..", "lambdas", "get-all.ts"),
      ...nodeJsFunctionProps,
    })
    const createOneLambda = new NodejsFunction(this, "createItemFunction", {
      entry: join(__dirname, "..", "lambdas", "create.ts"),
      ...nodeJsFunctionProps,
    })
    const updateOneLambda = new NodejsFunction(this, "updateItemFunction", {
      entry: join(__dirname, "..", "lambdas", "update-one.ts"),
      ...nodeJsFunctionProps,
    })
    const deleteOneLambda = new NodejsFunction(this, "deleteItemFunction", {
      entry: join(__dirname, "..", "lambdas", "delete-one.ts"),
      ...nodeJsFunctionProps,
    })

    // Grant the Lambda function read access to the DynamoDB table
    dynamoTable.grantReadWriteData(getAllLambda)
    dynamoTable.grantReadWriteData(getOneLambda)
    dynamoTable.grantReadWriteData(createOneLambda)
    dynamoTable.grantReadWriteData(updateOneLambda)
    dynamoTable.grantReadWriteData(deleteOneLambda)

    // Integrate the Lambda functions with the API Gateway resource
    const getAllIntegration = new LambdaIntegration(getAllLambda)
    const createOneIntegration = new LambdaIntegration(createOneLambda)
    const getOneIntegration = new LambdaIntegration(getOneLambda)
    const updateOneIntegration = new LambdaIntegration(updateOneLambda)
    const deleteOneIntegration = new LambdaIntegration(deleteOneLambda)

    // Create an API Gateway resource for each of the CRUD operations
    const api = new RestApi(this, "itemsApi", {
      restApiName: "Items Service",
    })
    const methodOption: MethodOptions = {
      authorizationType: AuthorizationType.NONE,
    }

    const items = api.root.addResource("items")

    items.addMethod("GET", getAllIntegration, {
      ...methodOption,
    })
    items.addMethod("POST", createOneIntegration, {
      ...methodOption,
    })
    addCorsOptions(items)

    const singleItem = items.addResource("{id}")
    singleItem.addMethod("GET", getOneIntegration, {
      ...methodOption,
    })
    singleItem.addMethod("PUT", updateOneIntegration, {
      ...methodOption,
    })
    singleItem.addMethod("DELETE", deleteOneIntegration, {
      ...methodOption,
    })
    addCorsOptions(singleItem)
  }
}

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      // In case you want to use binary media types, comment out the following line
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  )
}

const app = new App()
new ApiLambdaCrudDynamoDBStack(app, "ApiLambdaCrudDynamoDBExample")
app.synth()
