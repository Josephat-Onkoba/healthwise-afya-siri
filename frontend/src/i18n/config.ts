import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      title: 'HealthFirst',
      subtitle: 'Your Health Companion',
      selectLanguage: 'Select Language',
      askQuestion: 'Ask a Question',
      questionPlaceholder: 'Type your health-related question...',
      submit: 'Submit',
      uploadMedia: 'Upload Media',
      dragAndDrop: 'Drag and drop a file here, or click to select',
      dropHere: 'Drop your file here...',
      supportedFormats: 'Supported formats: JPG, PNG, MP4, MOV (max 16MB)',
      response: 'Response',
      processing: 'Processing...',
    },
  },
  sw: {
    translation: {
      title: 'HealthFirst',
      subtitle: 'Mshiriki Wako wa Afya',
      selectLanguage: 'Chagua Lugha',
      askQuestion: 'Uliza Swali',
      questionPlaceholder: 'Andika swali lako la afya...',
      submit: 'Wasilisha',
      uploadMedia: 'Pakia Media',
      dragAndDrop: 'Kokota na uache faili hapa, au bonyeza kuchagua',
      dropHere: 'Acha faili yako hapa...',
      supportedFormats: 'Muundo unaoungwa mkono: JPG, PNG, MP4, MOV (max 16MB)',
      response: 'Jibu',
      processing: 'Inachakata...',
    },
  },
  ha: {
    translation: {
      title: 'HealthFirst',
      subtitle: 'Abokin Lafiyar Ku',
      selectLanguage: 'Zaɓi Harshe',
      askQuestion: 'Yi Tambaya',
      questionPlaceholder: 'Rubuta tambayar lafiyar ku...',
      submit: 'Aika',
      uploadMedia: 'Loda Media',
      dragAndDrop: 'Ja da ka sauke fayil ɗin nan, ko danna don zaɓar',
      dropHere: 'Sauke fayil ɗin ku nan...',
      supportedFormats: 'Tsarin da ake tallafawa: JPG, PNG, MP4, MOV (max 16MB)',
      response: 'Amsa',
      processing: 'Ana sarrafawa...',
    },
  },
  yo: {
    translation: {
      title: 'HealthFirst',
      subtitle: 'Alabapín Rẹ̀ ní Ilera',
      selectLanguage: 'Yan Ede',
      askQuestion: 'Bé Èbé',
      questionPlaceholder: 'Kọ èbé ilera rẹ...',
      submit: 'Firanṣé',
      uploadMedia: 'Gbé Media Sókè',
      dragAndDrop: 'Fa fayìlì rẹ sí ibi yí, tàbí tẹ láti yan',
      dropHere: 'Sí fayìlì rẹ sí ibi yí...',
      supportedFormats: 'Àwọn fọ́rmàtì tí a gbà: JPG, PNG, MP4, MOV (max 16MB)',
      response: 'Ìdáhùn',
      processing: 'Ń ṣiṣẹ́...',
    },
  },
  ig: {
    translation: {
      title: 'HealthFirst',
      subtitle: 'Onye Ndụ Gị n\'Ahụike',
      selectLanguage: 'Họrọ Asụsụ',
      askQuestion: 'Jụọ Ajụjụ',
      questionPlaceholder: 'Dere ajụjụ ahụike gị...',
      submit: 'Nyefee',
      uploadMedia: 'Bulite Media',
      dragAndDrop: 'Dọkpụrụ ma hapụ faịlụ gị ebe a, ma ọ bụ pịa iji họrọ',
      dropHere: 'Hapụ faịlụ gị ebe a...',
      supportedFormats: 'Ụdị ndị a na-akwado: JPG, PNG, MP4, MOV (max 16MB)',
      response: 'Azịza',
      processing: 'Na-arụ ọrụ...',
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n; 