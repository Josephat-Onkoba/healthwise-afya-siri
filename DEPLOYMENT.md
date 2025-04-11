# Deployment Guide

This guide provides instructions for deploying both the backend and frontend components of the HealthFirst application.

## Backend Deployment (Google Cloud Run)

1. **Prerequisites**
   - Google Cloud account
   - Google Cloud CLI installed
   - Docker installed

2. **Setup Google Cloud Project**
   ```bash
   # Login to Google Cloud
   gcloud auth login
   
   # Create new project
   gcloud projects create healthfirst-app
   
   # Set project
   gcloud config set project healthfirst-app
   
   # Enable required APIs
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

3. **Deploy Backend**
   ```bash
   # Navigate to backend directory
   cd backend
   
   # Build and deploy to Cloud Run
   gcloud run deploy healthfirst-backend \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

4. **Set Environment Variables**
   ```bash
   gcloud run services update healthfirst-backend \
     --update-env-vars GOOGLE_API_KEY=your-api-key \
     --update-env-vars SECRET_KEY=your-secret-key
   ```

## Frontend Deployment (Vercel)

1. **Prerequisites**
   - Vercel account
   - Vercel CLI installed

2. **Deploy Frontend**
   ```bash
   # Navigate to frontend directory
   cd frontend
   
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Deploy
   vercel
   ```

3. **Set Environment Variables**
   - Go to Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add the following variables:
     ```
     NEXT_PUBLIC_API_URL=https://healthfirst-backend-xxxxx-uc.a.run.app/api
     ```

## Local Development

1. **Backend**
   ```bash
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Set environment variables
   cp .env.example .env
   # Edit .env with your configuration
   
   # Run development server
   flask run
   ```

2. **Frontend**
   ```bash
   # Install dependencies
   npm install
   
   # Set environment variables
   cp .env.example .env.local
   # Edit .env.local with your configuration
   
   # Run development server
   npm run dev
   ```

## Monitoring and Maintenance

1. **Backend Monitoring**
   - Use Google Cloud Console to monitor:
     - Request logs
     - Error rates
     - Resource usage
     - API quotas

2. **Frontend Monitoring**
   - Use Vercel Analytics to monitor:
     - Page views
     - Performance metrics
     - Error rates
     - User behavior

3. **Regular Maintenance**
   - Update dependencies regularly
   - Monitor API usage and quotas
   - Backup ChromaDB data
   - Review and update content moderation rules

## Security Considerations

1. **API Security**
   - Use HTTPS for all API calls
   - Implement rate limiting
   - Validate file uploads
   - Sanitize user input

2. **Data Privacy**
   - No PII storage
   - Regular security audits
   - Content moderation
   - Secure file handling

## Troubleshooting

1. **Common Issues**
   - API connection errors
   - File upload failures
   - Translation service issues
   - Memory limits exceeded

2. **Solutions**
   - Check environment variables
   - Verify API keys
   - Monitor error logs
   - Scale resources if needed

## Support

For additional support:
1. Check the documentation
2. Review error logs
3. Contact the development team
4. Submit issues on GitHub 