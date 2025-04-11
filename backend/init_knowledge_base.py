import os
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Sample knowledge base data
SAMPLE_DATA = [
    {
        "id": "1",
        "document": "Sexually transmitted infections (STIs) are infections that are passed from one person to another through sexual contact. Common STIs include chlamydia, gonorrhea, syphilis, and HIV.",
        "metadata": {
            "source": "WHO Fact Sheet",
            "category": "STIs",
            "topic": "General Information"
        }
    },
    {
        "id": "2",
        "document": "Symptoms of STIs can include unusual discharge, sores, itching, and pain during urination. However, many STIs may not show symptoms, which is why regular testing is important.",
        "metadata": {
            "source": "CDC Guidelines",
            "category": "STIs",
            "topic": "Symptoms"
        }
    },
    {
        "id": "3",
        "document": "Condoms are the most effective method of preventing STIs and unwanted pregnancies when used correctly and consistently. They should be used for all types of sexual activity.",
        "metadata": {
            "source": "WHO Guidelines",
            "category": "Prevention",
            "topic": "Protection Methods"
        }
    },
    {
        "id": "4",
        "document": "Regular testing for STIs is important, even if you don't have symptoms. Many STIs can be treated effectively if caught early. Testing is confidential and available at most health clinics.",
        "metadata": {
            "source": "CDC Guidelines",
            "category": "Testing",
            "topic": "Importance"
        }
    },
    {
        "id": "5",
        "document": "HIV (Human Immunodeficiency Virus) attacks the body's immune system. If left untreated, it can lead to AIDS (Acquired Immunodeficiency Syndrome). HIV can be managed with antiretroviral therapy.",
        "metadata": {
            "source": "WHO Fact Sheet",
            "category": "HIV/AIDS",
            "topic": "General Information"
        }
    },
    {
        "id": "6",
        "document": "Emergency contraception (morning-after pill) can prevent pregnancy if taken within 72 hours of unprotected sex. It is not an abortion pill and does not affect an existing pregnancy.",
        "metadata": {
            "source": "WHO Guidelines",
            "category": "Contraception",
            "topic": "Emergency Methods"
        }
    },
    {
        "id": "7",
        "document": "Consent is a clear, voluntary agreement between partners to engage in sexual activity. It must be given freely, without pressure, and can be withdrawn at any time.",
        "metadata": {
            "source": "WHO Guidelines",
            "category": "Consent",
            "topic": "Definition"
        }
    },
    {
        "id": "8",
        "document": "The menstrual cycle typically lasts 28 days, but can vary between 21 and 35 days. It includes menstruation, the follicular phase, ovulation, and the luteal phase.",
        "metadata": {
            "source": "WHO Fact Sheet",
            "category": "Reproductive Health",
            "topic": "Menstrual Cycle"
        }
    },
    {
        "id": "9",
        "document": "Pregnancy can be prevented through various methods including hormonal contraceptives (pills, patches, injections), barrier methods (condoms, diaphragms), and long-acting reversible contraceptives (IUDs, implants).",
        "metadata": {
            "source": "WHO Guidelines",
            "category": "Contraception",
            "topic": "Methods"
        }
    },
    {
        "id": "10",
        "document": "Sexual health is a state of physical, emotional, mental, and social well-being in relation to sexuality. It requires a positive and respectful approach to sexuality and sexual relationships.",
        "metadata": {
            "source": "WHO Definition",
            "category": "Sexual Health",
            "topic": "Definition"
        }
    }
]

def init_knowledge_base():
    """Initialize the knowledge base with sample data."""
    print("Initializing knowledge base...")
    
    # Create data directory if it doesn't exist
    os.makedirs("data/chroma", exist_ok=True)
    
    # Initialize ChromaDB
    client = chromadb.Client(Settings(
        chroma_db_impl="duckdb+parquet",
        persist_directory="data/chroma"
    ))
    
    # Create or get collection
    collection = client.get_or_create_collection("health_knowledge")
    
    # Add sample data
    ids = [item["id"] for item in SAMPLE_DATA]
    documents = [item["document"] for item in SAMPLE_DATA]
    metadatas = [item["metadata"] for item in SAMPLE_DATA]
    
    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    
    print(f"Added {len(SAMPLE_DATA)} items to the knowledge base.")
    print("Knowledge base initialized successfully!")

if __name__ == "__main__":
    init_knowledge_base() 