# SST Operations Action - Example Workflows

This directory contains comprehensive, production-ready examples for using the SST Operations Action in various scenarios. Each example is a complete GitHub Actions workflow that demonstrates best practices and real-world usage patterns.

## 📋 Available Examples

### [Basic Deploy](basic-deploy.yml)
**Use Case**: Simple deployment workflow for getting started

A straightforward deployment setup that:
- Deploys to staging on `develop` branch pushes
- Deploys to production on `main` branch pushes  
- Includes basic health checks and result reporting
- Demonstrates essential configuration and outputs usage

**Best For**: Teams getting started with SST Operations Action, simple deployment needs

### [PR Workflow](pr-workflow.yml)
**Use Case**: Comprehensive pull request automation

A sophisticated PR workflow that:
- Shows infrastructure diff comments on all PRs
- Deploys preview environments when labeled with `deploy-preview`
- Supports comment-based deployment commands (`/deploy preview`)
- Automatically cleans up resources when PRs are closed
- Includes permission checks for comment commands

**Best For**: Teams wanting full PR integration, preview environments, automated cleanup

### [Multi-Environment Pipeline](multi-environment.yml)
**Use Case**: Production-grade deployment pipeline

A staged deployment approach implementing:
- develop → staging → production pipeline
- Integration testing between environments
- Manual approval gates for production
- Environment-specific AWS credentials
- Comprehensive validation and rollback preparation

**Best For**: Enterprise teams, production environments requiring approval gates

### [Cleanup Strategies](cleanup.yml)
**Use Case**: Cost management and resource cleanup

Automated resource management including:
- Scheduled cleanup of unused PR environments
- Feature branch environment cleanup on branch deletion
- Age-based cleanup strategies
- Manual cleanup workflows with safety checks
- Emergency cleanup procedures with approval gates

**Best For**: Cost-conscious teams, preventing resource accumulation

### [Error Handling](error-handling.yml)
**Use Case**: Advanced error handling and recovery

Sophisticated error management featuring:
- Pre-deployment validation checks
- Intelligent retry mechanisms with backoff
- Failure classification and appropriate responses
- Comprehensive error reporting and notifications
- Post-deployment validation and rollback preparation

**Best For**: Mission-critical applications, teams needing robust error handling

## 🚀 Getting Started

### 1. Choose Your Starting Point

Pick the example that most closely matches your needs:

- **New to SST Operations Action?** → Start with [Basic Deploy](basic-deploy.yml)
- **Need PR integration?** → Use [PR Workflow](pr-workflow.yml)
- **Production deployment?** → Adapt [Multi-Environment Pipeline](multi-environment.yml)
- **Cost management focus?** → Implement [Cleanup Strategies](cleanup.yml)
- **High availability requirements?** → Use [Error Handling](error-handling.yml)

### 2. Required Setup

Before using any example, ensure you have:

#### Repository Secrets
```
AWS_ACCESS_KEY_ID       # AWS access key for deployments
AWS_SECRET_ACCESS_KEY   # AWS secret key for deployments
GITHUB_TOKEN           # Automatically provided by GitHub Actions
```

#### For Multi-Environment Pipeline
```
STAGING_AWS_ACCESS_KEY_ID     # Staging environment AWS credentials
STAGING_AWS_SECRET_ACCESS_KEY
PRODUCTION_AWS_ACCESS_KEY_ID   # Production environment AWS credentials  
PRODUCTION_AWS_SECRET_ACCESS_KEY
```

#### GitHub Repository Settings
- Enable GitHub Actions
- Configure branch protection rules (recommended for production)
- Set up environment protection rules for production deployments

### 3. Customization Guide

Each example includes detailed comments explaining:
- **Decision points** - Where you need to customize for your environment
- **Configuration options** - Available parameters and their effects
- **Integration points** - Where to add your own logic (notifications, tests, etc.)

#### Common Customizations

**AWS Region**
```yaml
env:
  AWS_REGION: us-west-2  # Change to your preferred region
```

**Node.js Version**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'  # Use your required version
```

**Branch Names**
```yaml
on:
  push:
    branches: 
      - main          # Your main branch name
      - development   # Your development branch name
```

**Stage Names**
```yaml
# Customize based on your environment naming
stage: ${{ github.ref_name == 'main' && 'prod' || 'dev' }}
```

## 🎯 Integration Patterns

### Combining Examples

You can combine patterns from multiple examples:

```yaml
# Use PR workflow for development + Multi-environment for releases
name: Combined Workflow

on:
  pull_request:
    # PR workflow logic here
  push:
    branches: [main]
    # Production deployment logic here
```

### Adding Custom Logic

Each example provides integration points for:

**Notifications**
```yaml
- name: Send Notification
  if: success()
  run: |
    # Add Slack, Teams, email, or webhook notifications
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -d '{"text": "Deployment successful!"}'
```

**Testing**
```yaml
- name: Custom Tests
  run: |
    # Add your test suite
    npm run test:integration
    npm run test:e2e
```

**Security Scanning**
```yaml
- name: Security Scan
  run: |
    # Add security scanning tools
    npm audit --audit-level=moderate
    npx snyk test
```

## 🔧 Troubleshooting

### Common Issues

#### "sst command not found"
**Solution**: Ensure SST is installed in your project
```yaml
- name: Install SST CLI  
  run: npm install @serverless-stack/cli
```

#### AWS credential errors
**Solution**: Verify secrets are set correctly
```yaml
- name: Debug AWS Setup
  run: |
    echo "AWS Region: $AWS_REGION"
    aws sts get-caller-identity
```

#### Stage validation errors
**Solution**: Check stage name format
```yaml
# Stage names must be alphanumeric with hyphens
stage: my-stage-123  # ✅ Valid
stage: my_stage      # ❌ Invalid (underscore)
```

### Debug Mode

Enable debug logging for troubleshooting:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  SST_DEBUG: "1"
```

## 📚 Best Practices

### Security
- Use least-privilege AWS credentials
- Store sensitive values in GitHub Secrets
- Enable branch protection for production branches
- Use environment protection rules for critical deployments

### Cost Management
- Implement cleanup strategies for temporary environments
- Use scheduled cleanup workflows
- Monitor AWS costs and set up billing alerts
- Consider using spot instances for CI/CD

### Reliability  
- Always include error handling
- Use retry mechanisms for transient failures
- Implement health checks post-deployment
- Prepare rollback procedures

### Maintainability
- Use clear, descriptive workflow names
- Comment complex logic thoroughly
- Keep workflows focused on single responsibilities
- Use reusable workflows for common patterns

## 🤝 Contributing

Have a workflow pattern that would be valuable to others? Contributions are welcome!

1. Create a new workflow file following the existing naming convention
2. Include comprehensive comments explaining the use case
3. Add configuration examples and customization guidance
4. Update this README with a description of your example

## 📞 Support

- 📖 [Main Documentation](../README.md)
- 🔍 [API Reference](../API.md)
- 💬 [GitHub Discussions](https://github.com/kodehort/sst-ops-action/discussions)
- 🐛 [Report Issues](https://github.com/kodehort/sst-ops-action/issues)