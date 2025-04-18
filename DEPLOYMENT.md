# Deployment Guide for Healthwise Afya Siri

This guide provides instructions for deploying both the backend and frontend components of the Healthwise Afya Siri application.

## Backend Deployment (Render.com)

1. **Prerequisites**
   - A Render.com account
   - Git repository with your code

2. **Deploy Backend to Render**
   
   **Option 1: Using the Render Dashboard**
   
   1. Log in to your Render account
   2. Click "New +" and select "Web Service"
   3. Connect your Git repository
   4. Configure the service:
      - Name: `healthwise-backend`
      - Environment: `Python`
      - Build Command: `pip install -r requirements.txt`
      - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
      - Select the `main` branch
   5. Add environment variables from your `.env` file:
      - `OPENAI_API_KEY`: Your OpenAI API key
      - `GOOGLE_API_KEY`: Your Google API key
      - `SECRET_KEY`: A secure random string
      - `ALLOWED_ORIGINS`: `https://healthwise-afya-siri.vercel.app`
      - `CHROMA_PERSIST_DIRECTORY`: `/data`
      - `UPLOAD_FOLDER`: `/uploads`
   6. Add disk storage:
      - Click "Advanced" and add two disks:
        1. Name: `data-disk`, Mount Path: `/data`, Size: 1GB
        2. Name: `uploads-disk`, Mount Path: `/uploads`, Size: 1GB
   7. Click "Create Web Service"

   **Option 2: Using the render.yaml file**
   
   1. Push the `render.yaml` file to your Git repository
   2. Visit the Render Dashboard and select "Blueprint"
   3. Connect your Git repository
   4. Render will automatically detect the configuration
   5. Review the settings and click "Apply"
   6. Add the sensitive environment variables manually

3. **Verify Backend Deployment**
   - Once deployed, test the API endpoint: `https://healthwise-backend.onrender.com/api/health`
   - You should receive a response with `{"status": "healthy"}`

## Frontend Deployment (Vercel)

1. **Prerequisites**
   - A Vercel account
   - Git repository with your code

2. **Deploy Frontend to Vercel**
   
   **Option 1: Using the Vercel Dashboard**
   
   1. Log in to your Vercel account
   2. Click "Add New" > "Project"
   3. Import your Git repository
   4. Configure the project:
      - Framework Preset: `Next.js`
      - Root Directory: `/frontend`
      - Build Command: `npm run build`
      - Output Directory: `.next`
   5. Add environment variables from your frontend `.env` file:
      - `NEXT_PUBLIC_API_URL`: `https://healthwise-backend.onrender.com/api`
   6. Click "Deploy"

   **Option 2: Using the Vercel CLI**
   
   1. Install the Vercel CLI: `npm i -g vercel`
   2. Navigate to the frontend directory: `cd frontend`
   3. Run: `vercel`
   4. Follow the prompts to link your project
   5. For production deployment, run: `vercel --prod`

3. **Verify Frontend Deployment**
   - Once deployed, visit your Vercel URL: `https://healthwise-afya-siri.vercel.app`
   - Ensure the application loads and can connect to the backend API

## Updating Environment Variables

### Backend (Render.com)
1. Go to your Web Service in the Render Dashboard
2. Navigate to the "Environment" tab
3. Add, edit, or remove environment variables
4. Click "Save Changes" - your service will automatically redeploy

### Frontend (Vercel)
1. Go to your Project in the Vercel Dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add, edit, or remove environment variables
4. Click "Save" - you'll need to redeploy for changes to take effect

## Troubleshooting

1. **Backend Connection Issues**
   - Check CORS configuration in `backend/app/main.py`
   - Verify environment variables on Render.com
   - Check Render logs for errors

2. **Frontend API Connection Issues**
   - Verify `NEXT_PUBLIC_API_URL` points to the correct backend URL
   - Check browser console for CORS or network errors
   - Ensure the backend is properly handling CORS headers

3. **Deployment Failures**
   - Check build logs for errors
   - Verify all dependencies are correctly listed in `requirements.txt` or `package.json`
   - Ensure your code is compatible with the deployment environment

## Maintenance

1. **Updating Your Application**
   - Push changes to your Git repository
   - Render and Vercel will automatically rebuild and deploy

2. **Monitoring**
   - Use Render's logging and metrics to monitor backend performance
   - Use Vercel Analytics to monitor frontend performance

3. **Scaling**
   - Upgrade your Render plan for more resources
   - Consider implementing caching for frequently accessed data

## Local Development

1. **Backend**
   ```