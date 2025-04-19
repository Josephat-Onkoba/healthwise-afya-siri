import os
import json
from typing import Dict, List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer

class KnowledgeBase:
    """A simple knowledge base for storing and retrieving health information."""
    
    def __init__(self):
        """Initialize the knowledge base."""
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
        self.topics = self._load_topics()
        self.embeddings = self._compute_embeddings()
    
    def _load_topics(self) -> Dict:
        """Load topics from JSON files in the data directory."""
        topics = {}
        try:
            # Create data directory if it doesn't exist
            os.makedirs(self.data_dir, exist_ok=True)
            
            # Load default topics if no files exist
            if not os.listdir(self.data_dir):
                topics = {
                    "sexual_health": {
                        "en": "Sexual health is about physical, mental, emotional, and social well-being in relation to sexuality.",
                        "sw": "Afya ya ngono inahusu ustawi wa kimwili, kiakili, kihisia na kijamii kuhusiana na masuala ya ngono.",
                        "ha": "Lafiyar jima'i tana nufin lafiyar jiki, hankali, tunani, da zamantakewa dangane da jima'i.",
                        "yo": "Ilera ti ara ni nipa ilera ara, ọpọlọ, ẹmi, ati awujọ ti o jẹmọ iṣẹlẹ ara.",
                        "ig": "Ahụike mmekọahụ bụ maka ahụike anụ ahụ, uche, mmetụta uche, na mmekọrịta ọha na eze n'ihe gbasara mmekọahụ."
                    },
                    "safe_sex": {
                        "en": "Safe sex involves using protection and getting regular check-ups to prevent STIs.",
                        "sw": "Ngono salama inahusisha kutumia kinga na kupata uchunguzi wa mara kwa mara kuzuia magonjwa ya ngono.",
                        "ha": "Jima'i mai aminci ya ƙunshi amfani da kariya da yin gwaje-gwaje na yau da kullun don hana cututtukan jima'i.",
                        "yo": "Iṣẹlẹ ara alailewu ni lati lo aabo ati lati gba iwadii ni gbogbo igba lati dẹkun awọn arun ti o nṣe lọ nipasẹ iṣẹlẹ ara.",
                        "ig": "Mmekọahụ nchekwa gụnyere iji nchebe na ịnweta nyocha oge niile iji gbochie ọrịa ndị a na-ebute site na mmekọahụ."
                    },
                    "contraception": {
                        "en": "Contraception methods help prevent unwanted pregnancies and protect against STIs.",
                        "sw": "Njia za uzazi wa mpango husaidia kuzuia mimba zisizotarajiwa na kujikinga dhidi ya magonjwa ya ngono.",
                        "ha": "Hanyoyin hana ciki suna taimakawa wajen hana ciki da ba a so ba da kuma kare daga cututtukan jima'i.",
                        "yo": "Awọn ọna iṣakoso ọjọ ori n ṣe iranlọwọ lati dẹkun ọjọ ori ti a ko fẹ ati lati dẹkun awọn arun ti o nṣe lọ nipasẹ iṣẹlẹ ara.",
                        "ig": "Ụzọ mgbochi afọ ime na-enyere aka igbochi afọ ime na-achọghị ma chebe megide ọrịa ndị a na-ebute site na mmekọahụ."
                    },
                    "hiv_aids": {
                        "en": "HIV is a virus that attacks the immune system, and AIDS is the most advanced stage of HIV infection.",
                        "sw": "Virusi vya UKIMWI hushambulia mfumo wa kinga mwilini, na UKIMWI ni hatua ya juu zaidi ya maambukizi ya virusi vya UKIMWI.",
                        "ha": "HIV wani ƙwayar cuta ce da ke kai hari ga tsarin garkuwar jiki, kuma AIDS shine mafi girman matakin kamuwa da cutar HIV.",
                        "yo": "HIV jẹ arun kan ti o nlu eto aabo ara, ati AIDS ni ipa ti o ga julọ ti arun HIV.",
                        "ig": "HIV bụ nje na-ebuso usoro ahụ ji alụso ọrịa ọgụ, na AIDS bụ ọkwa kachasị elu nke ọrịa HIV."
                    },
                    "menstrual_health": {
                        "en": "Menstrual health involves proper hygiene, tracking cycles, and understanding changes in the body.",
                        "sw": "Afya ya hedhi inahusisha usafi sahihi, kufuatilia mizunguko, na kuelewa mabadiliko katika mwili.",
                        "ha": "Lafiyar haila ta ƙunshi tsafta mai kyau, bin diddigin zagayowar haila, da fahimtar canje-canje a jiki.",
                        "yo": "Ilera ọjọ ori ni lati ni ilera ti o dara, ṣiṣe ayẹwo awọn ọjọ ori, ati lati loye awọn iyipada ninu ara.",
                        "ig": "Ahụike ịhụ nsọ gụnyere ịdị ọcha kwesịrị ekwesị, ịdepụta usoro, na ịghọta mgbanwe n'ahụ."
                    }
                }
                
                # Save default topics
                with open(os.path.join(self.data_dir, 'topics.json'), 'w', encoding='utf-8') as f:
                    json.dump(topics, f, ensure_ascii=False, indent=4)
            else:
                # Load existing topics
                for filename in os.listdir(self.data_dir):
                    if filename.endswith('.json'):
                        with open(os.path.join(self.data_dir, filename), 'r', encoding='utf-8') as f:
                            topics.update(json.load(f))
        except Exception as e:
            print(f"Error loading topics: {str(e)}")
            topics = {}
        
        return topics
    
    def _compute_embeddings(self) -> Dict:
        """Compute embeddings for all topics."""
        embeddings = {}
        try:
            for topic, content in self.topics.items():
                # Compute embeddings for English content
                if 'en' in content:
                    embeddings[topic] = self.model.encode(content['en'])
        except Exception as e:
            print(f"Error computing embeddings: {str(e)}")
        
        return embeddings
    
    def get_relevant_info(self, query: str, language: str = "en") -> Optional[str]:
        """
        Get relevant information based on the query.
        
        Args:
            query: The user's query
            language: The language code (default: "en")
            
        Returns:
            Relevant information or None if not found
        """
        try:
            # Encode the query
            query_embedding = self.model.encode(query)
            
            # Calculate similarities
            similarities = {}
            for topic, embedding in self.embeddings.items():
                similarity = np.dot(query_embedding, embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
                )
                similarities[topic] = similarity
            
            # Get the most relevant topic
            if similarities:
                best_topic = max(similarities.items(), key=lambda x: x[1])
                if best_topic[1] > 0.5:  # Similarity threshold
                    # Return content in the requested language if available, otherwise fall back to English
                    topic_content = self.topics[best_topic[0]]
                    return topic_content.get(language, topic_content.get('en', ''))
        except Exception as e:
            print(f"Error getting relevant info: {str(e)}")
        
        return None
    
    def get_topic_info(self, topic: str, language: str = "en") -> Optional[str]:
        """
        Get information about a specific topic.
        
        Args:
            topic: The topic name
            language: The language code (default: "en")
            
        Returns:
            Topic information or None if not found
        """
        if topic in self.topics:
            topic_content = self.topics[topic]
            return topic_content.get(language, topic_content.get('en', ''))
        return None
    
    def list_topics(self, language: str = "en") -> List[str]:
        """
        List all available topics.
        
        Args:
            language: The language code (default: "en")
            
        Returns:
            List of topic names
        """
        return list(self.topics.keys())
        
    def search(self, query: str, threshold: float = 0.5) -> List[str]:
        """
        Search the knowledge base for relevant information.
        
        Args:
            query: The search query
            threshold: Similarity threshold (default: 0.5)
            
        Returns:
            List of relevant information
        """
        results = []
        try:
            # Encode the query
            query_embedding = self.model.encode(query)
            
            # Calculate similarities
            for topic, embedding in self.embeddings.items():
                similarity = np.dot(query_embedding, embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
                )
                if similarity > threshold:
                    # Add English content to results
                    results.append(self.topics[topic].get('en', ''))
        except Exception as e:
            print(f"Error searching knowledge base: {str(e)}")
        
        return results
    
    def get_all_documents(self) -> List[dict]:
        """
        Get all documents in the knowledge base.
        
        Returns:
            List of documents with their metadata
        """
        documents = []
        try:
            for topic, content in self.topics.items():
                doc = {
                    "id": topic,
                    "content": content.get('en', ''),
                    "languages": list(content.keys())
                }
                documents.append(doc)
        except Exception as e:
            print(f"Error getting all documents: {str(e)}")
        
        return documents
        
    def add_document(self, text: str, metadata: Optional[dict] = None) -> str:
        """
        Add a document to the knowledge base.
        
        Args:
            text: Document text
            metadata: Optional metadata
            
        Returns:
            Document ID
        """
        # Generate a unique ID for the document
        import uuid
        doc_id = str(uuid.uuid4())
        
        # Extract language from metadata or default to English
        language = metadata.get('language', 'en') if metadata else 'en'
        
        # Create topic content
        topic_content = {language: text}
        
        # Add to topics
        self.topics[doc_id] = topic_content
        
        # Compute embedding
        self.embeddings[doc_id] = self.model.encode(text)
        
        # Save to file
        self._save_topics()
        
        return doc_id
        
    def _save_topics(self):
        """Save topics to file."""
        try:
            with open(os.path.join(self.data_dir, 'topics.json'), 'w', encoding='utf-8') as f:
                json.dump(self.topics, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"Error saving topics: {str(e)}") 