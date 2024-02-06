import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
const path = require('path');

// import * as rds from "aws-cdk-lib/aws-rds";
// import * as secretsManager from "aws-cdk-lib/aws-secretsmanager";

interface DatabaseProps {
  credentials: string;
  clusterIdentifier: string;
  defaultDatabaseName: string;
}

export class Database extends Construct {
  public readonly rds: cdk.aws_rds.IServerlessCluster;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    // Create the serverless cluster, provide all values needed to customise the database.
    this.rds = new cdk.aws_rds.ServerlessCluster(this, 'AuroraCluster', {
      engine: cdk.aws_rds.DatabaseClusterEngine.AURORA_MYSQL,
      credentials: { username: props.credentials },
      clusterIdentifier: props.clusterIdentifier,
      defaultDatabaseName: props.defaultDatabaseName,
    });
  }
}
