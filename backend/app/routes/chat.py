from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
import json
from ..services.gemini_service import GeminiService
from ..services.knowledge_base import KnowledgeBase

router = APIRouter()
gemini_service = GeminiService()
knowledge_base = KnowledgeBase()

@router.post("/chat/text")
async def chat_text(
    message: str = Form(...),
    language: str = Form("en"),
    context: Optional[str] = Form(None)
):
    """
    Handle text-based chat messages.
    
    Args:
        message: User's message
        language: Language code (default: "en")
        context: Optional conversation context
        
    Returns:
        AI response
    """
    try:
        # Get relevant knowledge base documents
        relevant_docs = knowledge_base.search_documents(message)
        context_docs = "\n".join([doc["content"] for doc in relevant_docs])
        
        # Generate response
        response = gemini_service.generate_text_response(
            message,
            language=language,
            context=context_docs
        )
        
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/image")
async def chat_image(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    language: str = Form("en")
):
    """
    Handle image analysis requests.
    
    Args:
        file: Image file
        message: Optional user message
        language: Language code (default: "en")
        
    Returns:
        Image analysis results
    """
    try:
        # Read image data
        image_data = await file.read()
        
        # Analyze image
        analysis = gemini_service.analyze_image(image_data)
        
        # If there's a message, generate a response
        if message:
            response = gemini_service.generate_text_response(
                f"{message}\n\nImage analysis: {analysis}",
                language=language
            )
            return {"analysis": analysis, "response": response}
        
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/video")
async def chat_video(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    language: str = Form("en")
):
    """
    Handle video analysis requests.
    
    Args:
        file: Video file
        message: Optional user message
        language: Language code (default: "en")
        
    Returns:
        Video analysis results
    """
    try:
        # Read video data
        video_data = await file.read()
        
        # Analyze video
        analysis = gemini_service.analyze_video(video_data)
        
        # If there's a message, generate a response
        if message:
            response = gemini_service.generate_text_response(
                f"{message}\n\nVideo analysis: {analysis}",
                language=language
            )
            return {"analysis": analysis, "response": response}
        
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/extract-text")
async def extract_text(
    file: UploadFile = File(...),
    language: str = Form("en")
):
    """
    Extract text from images.
    
    Args:
        file: Image file
        language: Language code (default: "en")
        
    Returns:
        Extracted text
    """
    try:
        # Read image data
        image_data = await file.read()
        
        # Extract text
        text = gemini_service.extract_text_from_image(image_data)
        
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 