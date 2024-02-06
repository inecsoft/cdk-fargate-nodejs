import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Networking } from './network-stack';
import { TaskDefinition } from 'aws-cdk-lib/aws-ecs';
const path = require('path');

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkFargateNodejsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // network implementation section
    const vpcStack: Networking = new Networking(this, 'NetworkingConstruct', {
      maxAzs: 3,
      natGateways: 1,
    });

    cdk.Tags.of(vpcStack).add('module', 'Network');
    // end of network implementation section

    // Database implementation section

    // Create username and password secret for DB Cluster
    // const secret = new cdk.aws_rds.DatabaseSecret(this, 'AuroraSecret', {
    //   username: 'clusteradmin',
    // });

    // const databasecluster = new cdk.aws_rds.DatabaseCluster(this, 'Database', {
    //   engine: cdk.aws_rds.DatabaseClusterEngine.auroraMysql({
    //     version: cdk.aws_rds.AuroraMysqlEngineVersion.VER_3_03_0,
    //   }),
    //   writer: cdk.aws_rds.ClusterInstance.provisioned('writer'),
    //   vpc: vpcStack.vpc,
    // });

    // const proxy = new cdk.aws_rds.DatabaseProxy(this, 'Proxy', {
    //   proxyTarget: cdk.aws_rds.ProxyTarget.fromCluster(databasecluster),
    //   secrets: [databasecluster.secret!],
    //   vpc: vpcStack.vpc,
    // });

    // const role = new cdk.aws_iam.Role(this, 'DBProxyRole', {
    //   assumedBy: new cdk.aws_iam.AccountPrincipal(this.account),
    // });
    // proxy.grantConnect(role, 'admin');

    // Database implementation section

    // CDN implementation section

    // const api = new cdk.aws_apigateway.RestApi(this, 'ApifargateEndpoint');

    // new cdk.CfnOutput(this, 'HTTP API Url', {
    //   value: api.url ?? 'Something went wrong with the deploy',
    // });

    const ecscluster = new cdk.aws_ecs.Cluster(this, 'ECSCluster', {
      enableFargateCapacityProviders: true,
      vpc: vpcStack.vpc,
    });

    cdk.Tags.of(ecscluster).add('Service', 'ECS-cluster');

    // needs investigation to be used
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns.ApplicationLoadBalancedFargateService.html
    // const frontend =
    //   new cdk.aws_ecs_patterns.ApplicationLoadBalancedFargateService(
    //     this,
    //     'FargateService',
    //     {
    //       cluster: ecscluster, // Required
    //       circuitBreaker: {
    //         rollback: true,
    //       },
    //       cpu: 512, // Default is 256
    //       desiredCount: 2, // Default is 1
    //       taskImageOptions: {
    //         image: cdk.aws_ecs.ContainerImage.fromDockerImageAsset(
    //           new cdk.aws_ecr_assets.DockerImageAsset(this, 'webserver', {
    //             directory: path.join(__dirname, '../webserver'),
    //           })
    //         ),
    //         containerPort: 8080,
    //         logDriver: cdk.aws_ecs.LogDrivers.awsLogs({
    //           streamPrefix: id,
    //           logRetention: cdk.aws_logs.RetentionDays.ONE_YEAR,
    //         }),
    //       },
    //       memoryLimitMiB: 512, // Default is 512
    //       publicLoadBalancer: true, // Default is true
    //       // securityGroups:
    //     }
    //   );

    const taskDefinition = new cdk.aws_ecs.FargateTaskDefinition(
      this,
      'TaskDef'
    );
    // public addContainer(id: string, props: ContainerDefinitionOptions): ContainerDefinition

    taskDefinition.addContainer('webserver', {
      image: cdk.aws_ecs.ContainerImage.fromDockerImageAsset(
        new cdk.aws_ecr_assets.DockerImageAsset(this, 'webserver', {
          directory: path.join(__dirname, '../webserver'),
        })
      ),
      cpu: 256,
      memoryLimitMiB: 512,
      logging: cdk.aws_ecs.LogDrivers.awsLogs({
        // prefix-name/container-name/ecs-task-id
        streamPrefix: '/aws/ecs',
        logRetention: cdk.aws_logs.RetentionDays.ONE_YEAR,
        // (logGroup: optional, default: A log group is automatically created.)
        // logGroup: new cdk.aws_logs.LogGroup(this, 'fargatecluster', {
        //   logGroupName: 'cdkIntegLogGroup',
        // }),
      }),
      portMappings: [
        { containerPort: 8080, protocol: cdk.aws_ecs.Protocol.TCP },
      ],
      // secrets:
    });

    console.log(TaskDefinition.fromTaskDefinitionAttributes.name);
    // taskDefinition.findPortMappingByName('webserver');

    //add private zone in route53
    // ecscluster.addDefaultCloudMapNamespace({
    //   name: 'webserver',
    // });

    const fargateservice = new cdk.aws_ecs.FargateService(
      this,
      'FargateService',
      {
        cluster: ecscluster,
        taskDefinition,
        // circuitBreaker: {
        //   rollback: true,
        // },
        desiredCount: 2, // Default is 1
        capacityProviderStrategies: [
          {
            capacityProvider: 'FARGATE_SPOT',
            weight: 2,
          },
          {
            capacityProvider: 'FARGATE',
            weight: 1,
          },
        ],
        assignPublicIp: true,
        // SecurityGroup:'',
      }
    );

    cdk.Tags.of(fargateservice).add('Service', 'ECS-fargate-service');

    const lb = new cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer(
      this,
      'ALB',
      { vpc: vpcStack.vpc, internetFacing: true }
    );

    const listener = lb.addListener('worldListener', { port: 80 });
    fargateservice.registerLoadBalancerTargets({
      containerName: 'webserver',
      containerPort: 8080,
      newTargetGroupId: 'ECSBlue',
      listener: cdk.aws_ecs.ListenerConfig.applicationListener(listener, {
        // protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
        protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
      }),
    });

    // Monitoring implementation section

    const cpuMetric = new cdk.aws_cloudwatch.Metric({
      metricName: 'CPUUtilization',
      namespace: 'AWS/ECS',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
      dimensionsMap: {
        ClusterName: ecscluster.clusterName,
        // Using `service.serviceName` here will cause a circular dependency
        ServiceName: fargateservice.cluster.clusterName,
      },
    });

    const fargateAlarm = new cdk.aws_cloudwatch.Alarm(this, 'CPUAlarm', {
      alarmName: 'cpuAlarmName',
      metric: cpuMetric,
      evaluationPeriods: 2,
      threshold: 80,
    });

    fargateservice.enableDeploymentAlarms([fargateAlarm.alarmName], {
      behavior: cdk.aws_ecs.AlarmBehavior.FAIL_ON_ALARM,
    });

    // END Monitoring implementation section

    // const LambdaIntegration = new cdk.aws_apigateway.LambdaIntegration(Lambda, {
    //   allowTestInvoke: false,
    // });
    // api.root.addMethod('ANY', LambdaIntegration);

    // api.root.addProxy({
    //   defaultIntegration: new cdk.aws_apigateway.LambdaIntegration(Lambda, {
    //     allowTestInvoke: false,
    //   }),
    //   anyMethod: true,
    // });

    const fargateLoggingBucket = new cdk.aws_s3.Bucket(
      this,
      'fargate-logging-bucket',
      {
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        versioned: true,
        accessControl: cdk.aws_s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      }
    );

    // const cloudfrontDistribution = new cdk.aws_cloudfront.Distribution(
    //   this,
    //   'Distribution',
    //   {
    //     defaultBehavior: {
    //       // origin: new cdk.aws_cloudfront_origins.RestApiOrigin(api),
    //       origin: new cdk.aws_cloudfront_origins.LoadBalancerV2Origin(
    //         clusterload
    //       ),
    //       // origin: new cdk.aws_cloudfront_origins.LoadBalancerV2Origin(
    //       //   cdk.aws_elasticloadbalancingv2.ILoadBalancerV2
    //       // ),
    //       // viewerProtocolPolicy:
    //       // cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //       // cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_DISABLED,
    //     },
    //     minimumProtocolVersion:
    //       cdk.aws_cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
    //     logBucket: fargateLoggingBucket,
    //     logFilePrefix: 'cloudfront-access-logs',
    //   }

    //   // CDN implementation section
    // );

    // new cdk.CfnOutput(this, 'CloudFront URL', {
    //   value: `https://${cloudfrontDistribution.distributionDomainName}`,
    // });
  }
}
