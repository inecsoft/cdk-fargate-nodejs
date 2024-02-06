import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
const path = require('path');

interface NetworkingProps {
  maxAzs: number;
  natGateways: number;
}

export class Networking extends Construct {
  public readonly vpc: cdk.aws_ec2.IVpc;

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    this.vpc = new cdk.aws_ec2.Vpc(this, 'vpc', {
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: props.natGateways,
      maxAzs: props.maxAzs,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
  }
}
