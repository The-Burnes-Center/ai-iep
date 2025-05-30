import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Spinner, 
  Alert, 
  Button,
  Badge,
  Accordion,
  Tabs,
  Tab,
  Offcanvas
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle, faLanguage } from '@fortawesome/free-solid-svg-icons';
import './IEPSummarizationAndTranslation.css';
import { IEPDocument, IEPSection } from '../../common/types';
import { useLanguage } from '../../common/language-context';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const { t, language, translationsLoaded } = useLanguage();
  
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showJargonDrawer, setShowJargonDrawer] = useState(false);
  const [selectedJargon, setSelectedJargon] = useState<{term: string, definition: string} | null>(null);

  const [document, setDocument] = useState<IEPDocument>({
    documentId: undefined,
    documentUrl: undefined,
    status: undefined,
    summaries: {
      en: '',
      es: '',
      vi: '',
      zh: ''
    },
    document_index: {
      en: '',
      es: '',
      vi: '',
      zh: ''
    },
    sections: {
      en: [],
      es: [],
      vi: [],
      zh: []
    }
  });
  
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('en');
  const navigate = useNavigate();
  
  // Reference to store the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef<boolean>(true);

  const preferredLanguage = language || 'en';

  // English jargon terms dictionary
  const englishJargonDictionary = {
    "Abeyance": "An abeyance is a temporary halt to something, with the emphasis on \"temporary.\"",
    "Accessibility": "Accessibility is the \"ability to access\" the functionality and benefit of some system or entity. This term is used to describe the degree to which a product (such as a device, a service, or an environment) is accessible by as many people as possible.",
    "Accommodations": "Accommodations are adaptations made for specific individuals with disabilities (as defined by law) when a product or service isn't accessible. These techniques and materials don't change the basic curriculum but do make learning a little easier and help students communicate what they know.",
    "Achievement Tests": "Measures of acquired knowledge in academic skills, such as reading, math, writing, and science.",
    "Adaptive Software": "Adaptive software is any software or program that builds a model of the preferences, goals, and knowledge of each individual student and uses that model throughout the interaction with the student in order to adapt to that student's assessed needs.",
    "Advocacy": "Recognizing and communicating needs, rights, and interests on behalf of a child; making informed choices.",
    "Alternative Dispute Resolution": "Alternative Dispute Resolution (ADR) is a mediation for the resolution of complaints between parents and school district personnel in a cooperative forum of problem-solving conducted by skilled neutral facilitators who are not SFUSD employees.",
    "Americans with Disabilities Act": "The ADA is a federal civil rights law that provides legal protections for individuals with disabilities from discrimination in employment, state and local government, public accommodations, commercial facilities, telecommunications, and transportation. Title II of the ADA requires schools to make educational opportunities, extracurricular activities, and facilities open and accessible to all students. These provisions apply to brick-and-mortar and online schooling.",
    "Assessment": "Process of identifying strengths and needs to assist in educational planning; includes observation, record review, interviews, and tests to develop appropriate educational programs, and to monitor progress",
    "Assessment Plan": "The description of the battery of tests (psychological, achievement, language, etc.) to be used in a particular student's assessment.",
    "Assistive Technology": "Assistive technology (AT) is any item, piece of equipment, product or system, whether acquired commercially off the shelf, modified, or customized, that is used to increase, maintain, or improve the functional capabilities of a child with a disability.",
    "Auditory Discrimination": "Ability to identify differences between words and sounds that are similar.",
    "Collaboration": "Working in partnership on behalf of a child, e.g., parent and teacher, or special education teacher and general education teacher.",
    "Compliance Complaint": "Complaint filed with the state department of education or local school district by a person who feels that an educational law has been broken.",
    "Discrepancy": "Difference between two tests, such as between measures of a child's intellectual ability and their academic achievement",
    "Distance Learning": "Distance learning involves how students engage in learning and make academic progress when they are not physically present in schools. This is accomplished using a variety of digital and print resources, and differentiated modes of interaction with teachers and peers, when possible. How teachers engage students in distance learning is informed by the student's access to technology and the internet.",
    "Due Process": "Procedural safeguards to protect the rights of the parent/guardian and the child under federal and state laws and regulations for special education; includes voluntary mediation or a due process hearing to resolve differences with the school.",
    "Dysarthria": "Difficult or unclear articulation of speech usually occurs when the muscles you use for speech are weak or you have difficulty controlling them; affects ability to pronounce sounds correctly.",
    "Dyscalculia": "Difficulty in understanding numbers which can impact basic math skills; trouble calculating.",
    "Dysgraphia": "Difficulty writing legibly with age-appropriate speed.",
    "Dyslexia": "Difficulty in learning to read or interpret words, letters, and other symbols. Can make reading, writing, spelling, listening, speaking, and math challenging.",
    "Dysnomia": "Difficulty remembering names or recalling specific words; word-finding problems.",
    "Dyspraxia": "Difficulty performing and sequencing fine motor movements, such as buttoning.",
    "IEP": "An IEP is a plan developed to ensure that a child who has a disability identified under the law receives specialized instruction and related services.",
    "Informed Consent": "Agreement in writing from parents that they have been informed and understand implications of special education evaluation and program decisions; permission is voluntary and may be withdrawn.",
    "Least restrictive environment": "A term meaning that children with disabilities must be educated (to the maximum extent appropriate) with children without disabilities.",
    "Modification": "Modifications are changes in the delivery, content, or instructional level of a subject or test. They result in changed or lowered expectations and create a different standard for kids with disabilities than for those without disabilities.",
    "Multidisciplinary Team": "Professionals with different training and expertise; may include, but is not limited to, any combination of the following public school personnel — general education teacher, special education teacher, administrator, school psychologist, speech and language therapist, counselor — and the parent.",
    "Occupational Therapy": "A related service that helps students improve fine motor skills and perform tasks needed for daily living and school activities.",
    "Primary Language": "Language that the child first learned, or the language that's spoken in the home.",
    "Prior Written Notice": "A Prior Written Notice (PWN) is a document that informs (provides notice to) a parent/guardian/education rights holder of actions that the school intends to take in regard to their child's Individualized Education Program. It is important that parents understand what the school plans to do (or not do) for their child.",
    "Procedural Safeguards": "Legal requirements that ensure parents and kids will be treated fairly and equally in the decision-making process about special education.",
    "Progress Reports": "Progress Reports must, at a minimum: inform parents of their child's progress toward each annual goal; determine whether progress is sufficient for their child to achieve the goals by the annual IEP due date; must be reported on when report cards are sent out ( a copy must be sent home to parent/guardian)",
    "Pupil Records": "Personal information about the child that is kept by the school system and is available for review by legal guardians and others directly involved in their education.",
    "Resiliency": "Ability to pursue personal goals and bounce back from challenges.",
    "Resource Specialist Program": "Students who can participate in regular education may also receive special education instruction in the RSP. These students can receive services within the classroom, or can be \"pulled out\" of the regular education classroom for special assistance during specific periods of the day or week and are taught by credentialed teachers with resource specialist authorization.",
    "Retention": "The practice of having a student repeat a certain grade-level (year) in school; also called grade retention.",
    "SB 117": "SB-117 is emergency legislation signed by Governor Newsom on March 17, 2020. SB-117 waived certain special education timelines in California, such as sending an assessment plan or responding to records requests.",
    "Section 504 of the Rehabilitation Act": "Section 504 of the Rehabilitation Act prohibits discrimination in the education of children and youth with disabilities; vocational education; college and other post-secondary programs; employment; health, welfare and other social programs; and other programs and activities that receive federal funds.",
    "Self-Advocacy": "Child's ability to explain specific learning needs and seek necessary assistance or accommodations.",
    "SOAR Academy": "SOAR is a special education setting that is designed to support students whose disabilities significantly impact their emotional regulation, social skills, and behaviors. SOAR stands for Success, Opportunity, Achievement and Resilience.",
    "Special Day Class": "Students in Special Day Classes (SDC) are enrolled in self-contained special education classes. They are assigned to these classes by their IEP eligibility and receive support from the Special Day Class teacher and the support staff.",
    "Special Education": "Specially designed instruction to meet the unique needs of eligible kids whose educational needs can't be met through modification of the regular instructional program; provides for a range of options for services, such as pull out programs, special day classes; available to kids enrolled in public schools.",
    "Special Education Local Plan Area ": "The county office from which some special education services are funded; SFUSD is both a local school district and the county office for San Francisco.",
    "Specialized Academic Instruction": "Specialized academic instruction (SAI) is determined by the IEP team and is derived from assessment information, data collected, and goals/objectives developed in the student's area(s) of need. Each student's educational needs are unique; thus, SAI and services may vary greatly between students.",
    "Speech Therapy": "A related service involving therapy to improve verbal communication abilities.",
    "Student Success Team": "A regular education process designed to make preliminary modifications within the regular education program of a student not succeeding in class. Each SST is to meet on a weekly basis.",
    "Transition": "Process of preparing kids to function in future environments and emphasizing movement from one educational program to another, such as from elementary school to middle school, or from school to work.",
    "Universal Design for Learning": "UDL is a way to optimize teaching to effectively instruct a diverse group of learners. The approach is based on insights from the science of how people learn. It emphasizes accessibility in how students access material, engage with it, and show what they have learned. UDL can be applied to in-person or virtual educational settings.",
    "Visual Processing": "Ability to interpret visual information",
  };

  const spanishJargonDictionary = {
    "Suspensión": "Una suspensión es una parada temporal de algo, con énfasis en \"temporal\".",
    "Accesibilidad": "La accesibilidad es la \"capacidad de acceder\" a la funcionalidad y beneficio de algún sistema o entidad. Este término se usa para describir el grado en que un producto es accesible para tantas personas como sea posible.",
    "Adaptaciones": "Las adaptaciones son ajustes realizados para personas específicas con discapacidades cuando un producto o servicio no es accesible. Estas técnicas y materiales no cambian el currículo básico pero facilitan el aprendizaje.",
    "Pruebas de Rendimiento": "Medidas del conocimiento adquirido en habilidades académicas, como lectura, matemáticas, escritura y ciencias.",
    "Software Adaptativo": "Software que construye un modelo de las preferencias, objetivos y conocimientos de cada estudiante individual y usa ese modelo para adaptarse a las necesidades evaluadas del estudiante.",
    "Defensa": "Reconocer y comunicar necesidades, derechos e intereses en nombre de un niño; tomar decisiones informadas.",
    "Resolución Alternativa de Disputas": "La RAD es una mediación para la resolución de quejas entre padres y personal del distrito escolar en un foro cooperativo de resolución de problemas.",
    "Ley de Estadounidenses con Discapacidades": "La ADA es una ley federal de derechos civiles que proporciona protecciones legales para personas con discapacidades contra la discriminación.",
    "Evaluación": "Proceso de identificar fortalezas y necesidades para ayudar en la planificación educativa; incluye observación, revisión de registros, entrevistas y pruebas.",
    "Plan de Evaluación": "La descripción de la batería de pruebas (psicológicas, de rendimiento, de idioma, etc.) que se usarán en la evaluación de un estudiante particular.",
    "Tecnología de Asistencia": "La tecnología de asistencia es cualquier artículo, equipo, producto o sistema que se utiliza para aumentar, mantener o mejorar las capacidades funcionales de un niño con discapacidad.",
    "Discriminación Auditiva": "Capacidad de identificar diferencias entre palabras y sonidos que son similares.",
    "Colaboración": "Trabajar en asociación en nombre de un niño, por ejemplo, padre y maestro, o maestro de educación especial y maestro de educación general.",
    "Queja de Cumplimiento": "Queja presentada ante el departamento estatal de educación o distrito escolar local por una persona que siente que se ha violado una ley educativa.",
    "Discrepancia": "Diferencia entre dos pruebas, como entre medidas de la capacidad intelectual de un niño y su rendimiento académico.",
    "Aprendizaje a Distancia": "El aprendizaje a distancia involucra cómo los estudiantes participan en el aprendizaje cuando no están físicamente presentes en las escuelas.",
    "Debido Proceso": "Salvaguardas procesales para proteger los derechos del padre/tutor y el niño bajo las leyes federales y estatales para educación especial.",
    "Disartria": "Articulación difícil o poco clara del habla que generalmente ocurre cuando los músculos que usas para hablar están débiles.",
    "Discalculia": "Dificultad para entender números que puede impactar las habilidades matemáticas básicas; problemas para calcular.",
    "Disgrafía": "Dificultad para escribir legiblemente con velocidad apropiada para la edad.",
    "Dislexia": "Dificultad para aprender a leer o interpretar palabras, letras y otros símbolos. Puede hacer que la lectura, escritura, ortografía, escucha, habla y matemáticas sean desafiantes.",
    "Disnomia": "Dificultad para recordar nombres o recordar palabras específicas; problemas para encontrar palabras.",
    "Dispraxia": "Dificultad para realizar y secuenciar movimientos motores finos, como abrocharse.",
    "IEP": "Un IEP es un plan desarrollado para asegurar que un niño que tiene una discapacidad identificada bajo la ley reciba instrucción especializada y servicios relacionados.",
    "Consentimiento Informado": "Acuerdo por escrito de los padres de que han sido informados y entienden las implicaciones de las decisiones de evaluación y programa de educación especial.",
    "Ambiente Menos Restrictivo": "Un término que significa que los niños con discapacidades deben ser educados (en la máxima medida apropiada) con niños sin discapacidades.",
    "Modificación": "Las modificaciones son cambios en la entrega, contenido o nivel instruccional de una materia o prueba. Resultan en expectativas cambiadas o reducidas.",
    "Equipo Multidisciplinario": "Profesionales con diferentes entrenamientos y experiencia; puede incluir personal escolar público como maestro de educación general, maestro de educación especial, administrador, psicólogo escolar.",
    "Terapia Ocupacional": "Un servicio relacionado que ayuda a los estudiantes a mejorar las habilidades motoras finas y realizar tareas necesarias para la vida diaria y actividades escolares.",
    "Idioma Primario": "Idioma que el niño aprendió primero, o el idioma que se habla en el hogar.",
    "Aviso Previo por Escrito": "Un Aviso Previo por Escrito es un documento que informa a un padre/tutor/titular de derechos educativos sobre las acciones que la escuela tiene la intención de tomar.",
    "Salvaguardas Procesales": "Requisitos legales que aseguran que los padres y niños sean tratados de manera justa e igualitaria en el proceso de toma de decisiones sobre educación especial.",
    "Informes de Progreso": "Los Informes de Progreso deben, como mínimo: informar a los padres sobre el progreso de su hijo hacia cada meta anual.",
    "Registros del Estudiante": "Información personal sobre el niño que es mantenida por el sistema escolar y está disponible para revisión por tutores legales y otros directamente involucrados en su educación.",
    "Resistencia": "Capacidad de perseguir metas personales y recuperarse de los desafíos.",
    "Programa de Especialista en Recursos": "Estudiantes que pueden participar en educación regular también pueden recibir instrucción de educación especial en el RSP.",
    "Retención": "La práctica de hacer que un estudiante repita un cierto nivel de grado (año) en la escuela; también llamada retención de grado.",
    "SB 117": "SB-117 es legislación de emergencia firmada por el Gobernador Newsom el 17 de marzo de 2020. SB-117 dispensó ciertos plazos de educación especial en California.",
    "Sección 504 de la Ley de Rehabilitación": "La Sección 504 de la Ley de Rehabilitación prohíbe la discriminación en la educación de niños y jóvenes con discapacidades.",
    "Autodefensa": "Capacidad del niño para explicar necesidades específicas de aprendizaje y buscar asistencia o adaptaciones necesarias.",
    "Academia SOAR": "SOAR es un entorno de educación especial diseñado para apoyar a estudiantes cuyas discapacidades impactan significativamente su regulación emocional, habilidades sociales y comportamientos.",
    "Clase de Día Especial": "Los estudiantes en Clases de Día Especial están inscritos en clases de educación especial autocontenidas.",
    "Educación Especial": "Instrucción especialmente diseñada para satisfacer las necesidades únicas de niños elegibles cuyas necesidades educativas no pueden ser satisfechas a través de la modificación del programa de instrucción regular.",
    "Área del Plan Local de Educación Especial": "La oficina del condado desde la cual se financian algunos servicios de educación especial.",
    "Instrucción Académica Especializada": "La instrucción académica especializada es determinada por el equipo del IEP y se deriva de información de evaluación, datos recopilados y metas/objetivos desarrollados.",
    "Terapia del Habla": "Un servicio relacionado que involucra terapia para mejorar las habilidades de comunicación verbal.",
    "Equipo de Éxito Estudiantil": "Un proceso de educación regular diseñado para hacer modificaciones preliminares dentro del programa de educación regular de un estudiante que no está teniendo éxito en clase.",
    "Transición": "Proceso de preparar a los niños para funcionar en futuros entornos y enfatizar el movimiento de un programa educativo a otro.",
    "Diseño Universal para el Aprendizaje": "UDL es una forma de optimizar la enseñanza para instruir efectivamente a un grupo diverso de estudiantes.",
    "Procesamiento Visual": "Capacidad de interpretar información visual."
  };

  // Vietnamese jargon terms dictionary
  const vietnameseJargonDictionary = {
    "Tạm hoãn": "Tạm hoãn là việc dừng tạm thời một việc gì đó, với sự nhấn mạnh vào \"tạm thời\".",
    "Khả năng tiếp cận": "Khả năng tiếp cận là \"khả năng truy cập\" chức năng và lợi ích của một hệ thống hoặc thực thể. Thuật ngữ này được sử dụng để mô tả mức độ mà một sản phẩm có thể được tiếp cận bởi càng nhiều người càng tốt.",
    "Điều chỉnh": "Các điều chỉnh là những thay đổi được thực hiện cho những cá nhân cụ thể có khuyết tật khi một sản phẩm hoặc dịch vụ không thể tiếp cận được. Những kỹ thuật và tài liệu này không thay đổi chương trình giảng dạy cơ bản.",
    "Bài kiểm tra thành tích": "Các biện pháp đo lường kiến thức đã học được trong các kỹ năng học thuật, như đọc, toán, viết và khoa học.",
    "Phần mềm thích ứng": "Phần mềm thích ứng là bất kỳ phần mềm hoặc chương trình nào xây dựng một mô hình về sở thích, mục tiêu và kiến thức của từng học sinh cá nhân.",
    "Ủng hộ": "Nhận biết và truyền đạt nhu cầu, quyền lợi và lợi ích thay mặt cho một đứa trẻ; đưa ra những lựa chọn có thông tin.",
    "Giải quyết tranh chấp thay thế": "ADR là một trung gian để giải quyết khiếu nại giữa phụ huynh và nhân viên học khu trong một diễn đàn hợp tác giải quyết vấn đề.",
    "Đạo luật người Mỹ khuyết tật": "ADA là một luật dân quyền liên bang cung cấp bảo vệ pháp lý cho các cá nhân khuyết tật khỏi sự phân biệt đối xử.",
    "Đánh giá": "Quá trình xác định điểm mạnh và nhu cầu để hỗ trợ trong việc lập kế hoạch giáo dục; bao gồm quan sát, xem xét hồ sơ, phỏng vấn và các bài kiểm tra.",
    "Kế hoạch đánh giá": "Mô tả về bộ các bài kiểm tra (tâm lý, thành tích, ngôn ngữ, v.v.) sẽ được sử dụng trong đánh giá của một học sinh cụ thể.",
    "Công nghệ hỗ trợ": "Công nghệ hỗ trợ là bất kỳ vật dụng, thiết bị, sản phẩm hoặc hệ thống nào được sử dụng để tăng cường, duy trì hoặc cải thiện khả năng chức năng của trẻ khuyết tật.",
    "Phân biệt thính giác": "Khả năng xác định sự khác biệt giữa các từ và âm thanh tương tự nhau.",
    "Hợp tác": "Làm việc đối tác thay mặt cho một đứa trẻ, ví dụ: phụ huynh và giáo viên, hoặc giáo viên giáo dục đặc biệt và giáo viên giáo dục thông thường.",
    "Khiếu nại tuân thủ": "Khiếu nại được nộp lên sở giáo dục tiểu bang hoặc học khu địa phương bởi một người cảm thấy rằng một luật giáo dục đã bị vi phạm.",
    "Khác biệt": "Sự khác biệt giữa hai bài kiểm tra, chẳng hạn như giữa các biện pháp đo khả năng trí tuệ của trẻ và thành tích học tập của chúng.",
    "Học từ xa": "Học từ xa liên quan đến cách học sinh tham gia học tập và đạt được tiến bộ học tập khi chúng không có mặt tại trường.",
    "Quy trình đúng đắn": "Các biện pháp bảo vệ thủ tục để bảo vệ quyền của phụ huynh/người giám hộ và trẻ em theo luật liên bang và tiểu bang về giáo dục đặc biệt.",
    "Khó phát âm": "Khó khăn hoặc không rõ ràng trong việc phát âm thường xảy ra khi các cơ bạn sử dụng để nói yếu hoặc bạn gặp khó khăn trong việc kiểm soát chúng.",
    "Khó tính toán": "Khó khăn trong việc hiểu số có thể ảnh hưởng đến các kỹ năng toán cơ bản; khó khăn trong việc tính toán.",
    "Khó viết": "Khó khăn trong việc viết một cách dễ đọc với tốc độ phù hợp với tuổi.",
    "Khó đọc": "Khó khăn trong việc học đọc hoặc diễn giải từ, chữ cái và các ký hiệu khác. Có thể làm cho việc đọc, viết, chính tả, nghe, nói và toán trở nên thách thức.",
    "Khó nhớ tên": "Khó khăn trong việc nhớ tên hoặc nhớ lại các từ cụ thể; các vấn đề tìm từ.",
    "Khó vận động": "Khó khăn trong việc thực hiện và sắp xếp các chuyển động vận động tinh, như cài cúc.",
    "IEP": "IEP là một kế hoạch được phát triển để đảm bảo rằng một đứa trẻ có khuyết tật được xác định theo luật pháp sẽ nhận được hướng dẫn chuyên môn và các dịch vụ liên quan.",
    "Sự đồng ý có thông tin": "Thỏa thuận bằng văn bản từ phụ huynh rằng họ đã được thông báo và hiểu các tác động của các quyết định đánh giá và chương trình giáo dục đặc biệt.",
    "Môi trường ít hạn chế nhất": "Một thuật ngữ có nghĩa là trẻ em khuyết tật phải được giáo dục (ở mức độ tối đa phù hợp) với trẻ em không khuyết tật.",
    "Sửa đổi": "Các sửa đổi là những thay đổi trong việc phân phối, nội dung hoặc mức độ hướng dẫn của một môn học hoặc bài kiểm tra.",
    "Nhóm đa ngành": "Các chuyên gia với đào tạo và chuyên môn khác nhau; có thể bao gồm nhân viên trường công lập như giáo viên giáo dục thông thường, giáo viên giáo dục đặc biệt.",
    "Trị liệu nghề nghiệp": "Một dịch vụ liên quan giúp học sinh cải thiện kỹ năng vận động tinh và thực hiện các nhiệm vụ cần thiết cho cuộc sống hàng ngày và hoạt động học tập.",
    "Ngôn ngữ chính": "Ngôn ngữ mà trẻ học đầu tiên, hoặc ngôn ngữ được nói trong nhà.",
    "Thông báo trước bằng văn bản": "Thông báo trước bằng văn bản là một tài liệu thông báo cho phụ huynh/người giám hộ/người nắm giữ quyền giáo dục về các hành động mà trường định thực hiện.",
    "Các biện pháp bảo vệ thủ tục": "Các yêu cầu pháp lý đảm bảo rằng phụ huynh và trẻ em sẽ được đối xử công bằng và bình đẳng trong quá trình ra quyết định về giáo dục đặc biệt.",
    "Báo cáo tiến độ": "Báo cáo tiến độ phải, ít nhất: thông báo cho phụ huynh về tiến độ của con họ hướng tới mỗi mục tiêu hàng năm.",
    "Hồ sơ học sinh": "Thông tin cá nhân về trẻ được hệ thống trường học lưu giữ và có sẵn để xem xét bởi người giám hộ hợp pháp và những người khác trực tiếp tham gia vào việc giáo dục của chúng.",
    "Khả năng phục hồi": "Khả năng theo đuổi các mục tiêu cá nhân và phục hồi từ các thách thức.",
    "Chương trình chuyên gia tài nguyên": "Học sinh có thể tham gia giáo dục thông thường cũng có thể nhận được hướng dẫn giáo dục đặc biệt trong RSP.",
    "Lưu ban": "Thực hành cho học sinh lặp lại một cấp lớp nhất định (năm) trong trường; còn được gọi là lưu ban cấp lớp.",
    "SB 117": "SB-117 là luật khẩn cấp được Thống đốc Newsom ký vào ngày 17 tháng 3 năm 2020. SB-117 đã miễn một số thời hạn giáo dục đặc biệt ở California.",
    "Mục 504 của Đạo luật Phục hồi chức năng": "Mục 504 của Đạo luật Phục hồi chức năng cấm phân biệt đối xử trong việc giáo dục trẻ em và thanh thiếu niên khuyết tật.",
    "Tự ủng hộ": "Khả năng của trẻ em giải thích các nhu cầu học tập cụ thể và tìm kiếm sự hỗ trợ hoặc điều chỉnh cần thiết.",
    "Học viện SOAR": "SOAR là một môi trường giáo dục đặc biệt được thiết kế để hỗ trợ học sinh có khuyết tật ảnh hưởng đáng kể đến điều hòa cảm xúc, kỹ năng xã hội và hành vi của họ.",
    "Lớp ngày đặc biệt": "Học sinh trong các Lớp ngày đặc biệt được ghi danh vào các lớp giáo dục đặc biệt độc lập.",
    "Giáo dục đặc biệt": "Hướng dẫn được thiết kế đặc biệt để đáp ứng nhu cầu độc đáo của trẻ em đủ điều kiện mà nhu cầu giáo dục không thể được đáp ứng thông qua việc sửa đổi chương trình giảng dạy thông thường.",
    "Khu vực kế hoạch địa phương giáo dục đặc biệt": "Văn phòng quận từ đó một số dịch vụ giáo dục đặc biệt được tài trợ.",
    "Hướng dẫn học thuật chuyên môn": "Hướng dẫn học thuật chuyên môn được xác định bởi nhóm IEP và được rút ra từ thông tin đánh giá, dữ liệu thu thập và các mục tiêu/đối tượng được phát triển.",
    "Trị liệu ngôn ngữ": "Một dịch vụ liên quan bao gồm trị liệu để cải thiện khả năng giao tiếp bằng lời nói.",
    "Nhóm thành công học sinh": "Một quy trình giáo dục thông thường được thiết kế để thực hiện các sửa đổi sơ bộ trong chương trình giáo dục thông thường của một học sinh không thành công trong lớp.",
    "Chuyển tiếp": "Quá trình chuẩn bị cho trẻ em hoạt động trong các môi trường tương lai và nhấn mạnh việc chuyển từ chương trình giáo dục này sang chương trình khác.",
    "Thiết kế phổ quát cho học tập": "UDL là một cách để tối ưu hóa việc giảng dạy để hướng dẫn hiệu quả một nhóm học viên đa dạng.",
    "Xử lý thị giác": "Khả năng diễn giải thông tin thị giác."
  };

  // Chinese jargon terms dictionary
  const chineseJargonDictionary = {
    "可访问性": "可访问性是 访问 某个系统或实体的功能和益处的 能力 。这个术语用来描述产品能够被尽可能多的人访问的程度。",
    "适应性调整": "适应性调整是为有残疾的特定个人在产品或服务无法获得时所做的改编。这些技术和材料不会改变基本课程，但会使学习变得更容易。",
    "成就测试": "在学术技能方面获得知识的测量，如阅读、数学、写作和科学。",
    "自适应软件": "自适应软件是任何为每个学生建立偏好、目标和知识模型的软件或程序，并在与学生的整个互动过程中使用该模型来适应学生的评估需求。",
    "倡导": "代表儿童识别和传达需求、权利和利益；做出明智的选择。",
    "替代争议解决": "ADR是在家长和学区人员之间解决投诉的调解，在由熟练的中立促进者主持的合作问题解决论坛中进行。",
    "美国残疾人法案": "ADA是一项联邦民权法，为残疾人提供法律保护，防止在就业、州和地方政府、公共场所、商业设施、电信和交通方面的歧视。",
    "评估": "识别优势和需求以协助教育规划的过程；包括观察、记录审查、访谈和测试，以制定适当的教育计划并监控进展。",
    "评估计划": "描述将在特定学生评估中使用的测试套件（心理学、成就、语言等）。",
    "辅助技术": "辅助技术（AT）是用于增强、维持或改善残疾儿童功能能力的任何物品、设备、产品或系统。",
    "听觉辨别": "识别相似单词和声音之间差异的能力。",
    "合作": "代表儿童进行伙伴关系工作，例如，家长和教师，或特殊教育教师和普通教育教师。",
    "合规投诉": "由认为教育法律被违反的人向州教育部门或当地学区提出的投诉。",
    "差异": "两个测试之间的差异，例如儿童智力能力和学术成就的测量之间的差异。",
    "远程学习": "远程学习涉及学生在不在学校时如何参与学习和取得学术进步。这通过各种数字和印刷资源以及与教师和同伴的差异化互动模式来实现。",
    "正当程序": "保护家长/监护人和儿童在联邦和州特殊教育法律法规下权利的程序保障；包括自愿调解或正当程序听证会来解决与学校的分歧。",
    "构音障碍": "言语的困难或不清楚的发音通常发生在您用于说话的肌肉较弱或您难以控制它们时；影响正确发音的能力。",
    "计算障碍": "理解数字的困难，这可能影响基本数学技能；计算困难。",
    "书写障碍": "以适合年龄的速度清楚书写的困难。",
    "阅读障碍": "学习阅读或解释单词、字母和其他符号的困难。可能使阅读、写作、拼写、听力、说话和数学变得具有挑战性。",
    "命名困难": "记住名字或回忆特定单词的困难；找词问题。",
    "运动协调障碍": "执行和排序精细运动动作的困难，例如扣纽扣。",
    "IEP": "IEP是制定的计划，以确保根据法律确定有残疾的儿童获得专门的指导和相关服务。",
    "知情同意": "家长的书面同意，表示他们已被告知并理解特殊教育评估和项目决定的含义；许可是自愿的，可以撤回。",
    "最少限制环境": "一个术语，意思是残疾儿童必须（在最大适当程度上）与非残疾儿童一起接受教育。",
    "修改": "修改是对科目或测试的交付、内容或教学水平的更改。它们导致期望的改变或降低，为残疾儿童创造了与非残疾儿童不同的标准。",
    "多学科团队": "具有不同培训和专业知识的专业人员；可能包括但不限于以下公立学校人员的任何组合——普通教育教师、特殊教育教师、管理员、学校心理学家、言语和语言治疗师、顾问——以及家长。",
    "职业治疗": "一项相关服务，帮助学生改善精细运动技能并执行日常生活和学校活动所需的任务。",
    "主要语言": "儿童首先学会的语言，或在家中说的语言。",
    "事先书面通知": "事先书面通知（PWN）是一份文件，告知家长/监护人/教育权利持有人学校打算对其孩子的个性化教育计划采取的行动。",
    "程序保障": "确保家长和孩子在特殊教育决策过程中得到公平和平等对待的法律要求。",
    "进度报告": "进度报告必须至少：告知家长孩子朝向每个年度目标的进度；确定进度是否足够让孩子在年度IEP到期日之前实现目标。",
    "学生记录": "学校系统保存的关于儿童的个人信息，可供法定监护人和其他直接参与其教育的人员查阅。",
    "复原力": "追求个人目标和从挑战中恢复的能力。",
    "留级": "让学生重复某个年级水平（年）的做法；也称为年级留级。",
    "SB 117": "SB-117是州长纽森于2020年3月17日签署的紧急立法。SB-117豁免了加利福尼亚州的某些特殊教育时间表。",
    "康复法案第504条": "康复法案第504条禁止在残疾儿童和青少年的教育中的歧视；职业教育；大学和其他高等教育项目；就业；健康、福利和其他社会项目。",
    "自我倡导": "儿童解释特定学习需求并寻求必要帮助或调整的能力。",
    "SOAR学院": "SOAR是一个特殊教育环境，旨在支持那些残疾严重影响其情绪调节、社交技能和行为的学生。SOAR代表成功、机会、成就和复原力。",
    "特殊日班": "特殊日班（SDC）的学生被安排在自足的特殊教育班级中。他们根据IEP资格被分配到这些班级。",
    "特殊教育": "专门设计的指导，以满足符合条件的儿童的独特需求，这些儿童的教育需求无法通过修改常规教学计划来满足。",
    "特殊教育地方计划区域": "资助一些特殊教育服务的县办公室；SFUSD既是地方学区，也是旧金山的县办公室。",
    "专门学术指导": "专门学术指导（SAI）由IEP团队确定，并来自评估信息、收集的数据以及在学生需求领域开发的目标/目的。",
    "言语治疗": "涉及治疗以改善言语交流能力的相关服务。",
    "学生成功团队": "一个常规教育过程，旨在为在班级中不成功的学生在常规教育项目内进行初步修改。",
    "过渡": "准备儿童在未来环境中发挥作用并强调从一个教育项目转移到另一个教育项目的过程，例如从小学到中学，或从学校到工作。",
    "学习通用设计": "UDL是一种优化教学以有效指导多样化学习者群体的方法。该方法基于人们如何学习的科学见解。",
    "视觉处理": "解释视觉信息的能力。"
  };

  // Combined jargon dictionaries
  const jargonDictionaries = {
    en: englishJargonDictionary,
    es: spanishJargonDictionary,
    vi: vietnameseJargonDictionary,
    zh: chineseJargonDictionary
  };

  // Configure minimal marked options that are type-safe
  marked.setOptions({
    gfm: true,
    breaks: true
  });

  // Section configuration with translations
  const sectionConfigRef = useRef([
    { apiName: "Strengths", englishName: "Strengths", displayName: t('sections.strengths') },
    { apiName: "Eligibility", englishName: "Eligibility", displayName: t('sections.eligibility') },
    { apiName: "Present Levels", englishName: "Present Levels of Performance", displayName: t('sections.presentLevels') },
    { apiName: "Goals", englishName: "Goals", displayName: t('sections.goals') },
    { apiName: "Services", englishName: "Services", displayName: t('sections.services') },
    { apiName: "Accommodations", englishName: "Accommodations", displayName: t('sections.accommodations') },
    { apiName: "Placement", englishName: "Placement", displayName: t('sections.placement') },
    { apiName: "Key People", englishName: "Key People", displayName: t('sections.keyPeople') },
    { apiName: "Informed Consent", englishName: "Consent", displayName: t('sections.informedConsent') },
  ]);

  // Handle jargon click
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('jargon-term')) {
      e.preventDefault();
      const term = target.textContent || '';
      const definition = target.getAttribute('data-tooltip') || '';
      setSelectedJargon({ term, definition });
      setShowJargonDrawer(true);
    }
  };

  // Generic function to process content with jargon for any language
  const processContentWithJargon = (content: string, languageCode: string): string => {
    if (!content) return '';
    
    // Convert markdown to HTML
    const htmlContent = marked.parse(content);
    const htmlString = typeof htmlContent === 'string' ? htmlContent : '';
    
    // Get the appropriate jargon dictionary for the language
    const jargonDict = jargonDictionaries[languageCode as keyof typeof jargonDictionaries];
    
    if (!jargonDict) {
      // If no jargon dictionary exists for this language, just return sanitized HTML
      return DOMPurify.sanitize(htmlString);
    }
    
    // Create a safe copy of the content to process
    let processedContent = htmlString;
    
    // Sort jargon terms by length (longest first) to avoid conflicts
    const sortedTerms = Object.keys(jargonDict).sort((a, b) => b.length - a.length);
    
    // Process each jargon term
    sortedTerms.forEach(term => {
      // Escape special regex characters in the term
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
      
      // Check if this term exists in the content
      const matches = processedContent.match(regex);
      if (matches) {
        // Properly escape the definition for HTML attribute
        const escapedDefinition = jargonDict[term]
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        // Replace only if the term is not already inside a data-tooltip attribute or jargon span
        processedContent = processedContent.replace(regex, (match, offset, string) => {
          // Get the text before this match
          const beforeMatch = string.substring(0, offset);
          
          // Check if we're already inside a jargon span
          const lastSpanStart = beforeMatch.lastIndexOf('<span class="jargon-term"');
          const lastSpanEnd = beforeMatch.lastIndexOf('</span>');
          
          if (lastSpanStart > lastSpanEnd) {
            return match; // We're inside a jargon span, don't replace
          }
          
          // Simple check for data-tooltip attributes
          // Look for data-tooltip=" that's not closed before our position
          const tooltipMatches = beforeMatch.match(/data-tooltip="[^"]*$/);
          if (tooltipMatches) {
            return match; // We're inside an unclosed tooltip attribute
          }
          
          return `<span class="jargon-term" data-tooltip="${escapedDefinition}">${match}</span>`;
        });
      }
    });
    
    // Return sanitized HTML
    return DOMPurify.sanitize(processedContent);
  };

  // Original processContent function (now just calls the generic function with 'en')
  const processContent = (content: string, processJargon: boolean = true): string => {
    if (!processJargon) {
      const htmlContent = marked.parse(content);
      const htmlString = typeof htmlContent === 'string' ? htmlContent : '';
      return DOMPurify.sanitize(htmlString);
    }
    
    return processContentWithJargon(content, 'en');
  };
  
  // Update section config with translations when language changes
  useEffect(() => {
    if (translationsLoaded) {
      sectionConfigRef.current = [
        { apiName: "Strengths", englishName: "Strengths", displayName: t('sections.strengths') },
        { apiName: "Eligibility", englishName: "Eligibility", displayName: t('sections.eligibility') },
        { apiName: "Present Levels", englishName: "Present Levels of Performance", displayName: t('sections.presentLevels') },
        { apiName: "Goals", englishName: "Goals", displayName: t('sections.goals') },
        { apiName: "Services", englishName: "Services", displayName: t('sections.services') },
        { apiName: "Accommodations", englishName: "Accommodations", displayName: t('sections.accommodations') },
        { apiName: "Placement", englishName: "Placement", displayName: t('sections.placement') },
        { apiName: "Key People", englishName: "Key People", displayName: t('sections.keyPeople') },
        { apiName: "Informed Consent", englishName: "Consent", displayName: t('sections.informedConsent') },
      ];
      
      // Reprocess sections if document is already loaded
      if (document && document.status === "PROCESSED") {
        processDocumentSections(document);
      }
    }
  }, [t, translationsLoaded]);

  const getDisplayName = (apiName: string, useTranslation: boolean = false): string => {
    const config = sectionConfigRef.current.find(s => 
      s.apiName === apiName || 
      s.englishName === apiName || 
      apiName.toLowerCase().includes(s.apiName.toLowerCase())
    );
    
    if (!config) return apiName;
    return useTranslation ? config.displayName : config.englishName;
  };

  // Function to sort sections by predefined order
  const sortSections = (sections: IEPSection[]) => {
    return [...sections].sort((a, b) => {
      const indexA = sectionConfigRef.current.findIndex(s => 
        s.apiName === a.name || 
        s.englishName === a.name ||
        a.name.toLowerCase().includes(s.apiName.toLowerCase())
      );
      const indexB = sectionConfigRef.current.findIndex(s => 
        s.apiName === b.name || 
        s.englishName === b.name ||
        b.name.toLowerCase().includes(s.apiName.toLowerCase())
      );
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  };

  // Process document sections for a specific language
  const processLanguageSections = (doc: any, lang: string) => {
    if (!doc || doc.status !== "PROCESSED") return;
    
    if (doc.sections && doc.sections[lang]) {
      try {
        const extractedSections = [];
        
        if (Array.isArray(doc.sections[lang])) {
          console.log(`Processing ${lang} sections as array`);
          doc.sections[lang].forEach(section => {
            if (section.title && section.content) {
              extractedSections.push({
                name: section.title,
                displayName: getDisplayName(section.title, lang !== 'en'),
                content: section.content,
                pageNumbers: section.page_numbers || []
              });
            }
          });
        }
        
        const orderedSections = sortSections(extractedSections);
        console.log(`Processed ${lang} sections:`, orderedSections);
        
        setDocument(prev => ({
          ...prev, 
          sections: { 
            ...prev.sections,
            [lang]: orderedSections
          }
        }));
      } catch (e) {
        console.error(`Error processing ${lang} sections:`, e);
        setDocument(prev => ({
          ...prev, 
          sections: { 
            ...prev.sections,
            [lang]: []
          }
        }));
      }
    } else {
      console.log(`No ${lang} sections found`);
      setDocument(prev => ({
        ...prev, 
        sections: { 
          ...prev.sections,
          [lang]: []
        }
      }));
    }
  };

  // Process all document sections
  const processDocumentSections = (doc: any) => {
    // Process English sections first
    processLanguageSections(doc, 'en');
    
    // Process preferred language if it's not English
    if (preferredLanguage !== 'en') {
      processLanguageSections(doc, preferredLanguage);
    }
  };

  // Function to start polling if document is processing
  const startPollingIfProcessing = (doc: any) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (doc && doc.status === "PROCESSING") {
      console.log("Document is processing. Starting polling...");
      pollingIntervalRef.current = setInterval(() => {
        console.log("Polling for updates...");
        setRefreshCounter(prev => prev + 1);
      }, 5000);
    }
  };

  // Fetch document data
  useEffect(() => {
    if (!translationsLoaded) return;
    
    const fetchDocument = async () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
      }
      
      try {
        const retrievedDocument = await apiClient.getMostRecentDocumentWithSummary();
        console.log("Fetched document data:", retrievedDocument);
        
        if (retrievedDocument) {
          setDocument(prev => {
            if (!prev || 
                prev.status !== retrievedDocument.status || 
                prev.createdAt !== retrievedDocument.createdAt) {
              return {
                ...retrievedDocument,
                sections: {
                  ...prev.sections, // Keep existing processed sections
                  ...(retrievedDocument.sections || {}) // Add new sections if available
                }
              };
            }
            return prev;
          });
          
          startPollingIfProcessing(retrievedDocument);
          
          if (retrievedDocument.status === "PROCESSED") {
            // Set summaries
            const newSummaries = { ...document.summaries };
            
            // Update each available language summary
            if (retrievedDocument.summaries) {
              Object.keys(retrievedDocument.summaries).forEach(lang => {
                if (retrievedDocument.summaries[lang]) {
                  newSummaries[lang] = retrievedDocument.summaries[lang];
                }
              });
            }
            
            // Set document index
            const newDocumentIndex = { ...document.document_index };
            
            // Update each available language document index
            if (retrievedDocument.document_index) {
              Object.keys(retrievedDocument.document_index).forEach(lang => {
                if (retrievedDocument.document_index[lang]) {
                  newDocumentIndex[lang] = retrievedDocument.document_index[lang];
                }
              });
            }
            
            setDocument(prev => ({
              ...prev, 
              summaries: newSummaries,
              document_index: newDocumentIndex
            }));
            
            // Process sections
            processDocumentSections(retrievedDocument);
          }
        } else {
          // Clear document data if no document found
          setDocument(prev => ({
            ...prev,
            documentId: undefined,
            documentUrl: undefined,
            status: undefined,
            summaries: {
              en: '',
              es: '',
              vi: '',
              zh: ''
            },
            document_index: {
              en: '',
              es: '',
              vi: '',
              zh: ''
            },
            sections: {
              en: [],
              es: [],
              vi: [],
              zh: []
            }
          }));
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching document:', err);
      } finally {
        if (initialLoading) {
          setInitialLoading(false);
        }
      }
    };
    
    fetchDocument();
    
    // Clean up interval
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [refreshCounter, translationsLoaded]);

  // Safe check for content availability
  const hasContent = (lang: string) => {
    const hasSummary = Boolean(document.summaries && document.summaries[lang]);
    const hasDocumentIndex = Boolean(document.document_index && document.document_index[lang]);
    const hasSections = Boolean(
      document.sections && 
      document.sections[lang] && 
      document.sections[lang].length > 0
    );
    return hasSummary || hasSections || hasDocumentIndex;
  };

  // Set active tab based on language preference and content availability
  useEffect(() => {
    // Default to English tab
    let tabToShow = 'en';
    
    // If user prefers another language and content exists for that language, show it
    if (preferredLanguage !== 'en' && hasContent(preferredLanguage)) {
      tabToShow = preferredLanguage;
    }
    
    setActiveTab(tabToShow);
  }, [language, document.summaries, document.sections, preferredLanguage]);

  const handleBackClick = () => {
    navigate('/welcome-page');
  };

  // Extract filename from document URL
  const getFileName = (documentUrl: string) => {
    if (!documentUrl) return 'Document';
    return documentUrl.split('/').pop() || 'Document';
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch(status) {
      case "PROCESSING":
        return <Badge bg="warning" text="dark"><FontAwesomeIcon icon={faClock} className="me-1" /> Processing</Badge>;
      case "PROCESSED":
        return <Badge bg="success"><FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Processed</Badge>;
      case "FAILED":
        return <Badge bg="danger"><FontAwesomeIcon icon={faExclamationTriangle} className="me-1" /> Failed</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Render tab content for a specific language
  const renderTabContent = (lang: string) => {
    const hasSummary = document.summaries && document.summaries[lang];
    const hasDocumentIndex = document.document_index && document.document_index[lang];
    const hasSections = (
      document.sections && 
      document.sections[lang] && 
      document.sections[lang].length > 0
    );
    
    const isEnglishTab = lang === 'en';

    return (
      <>        
        {/* Summary Section */}
        {hasSummary ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'IEP Summary' : t('summary.iepSummary')}
            </h4>
            <Card className="summary-content mb-3">
              <Card.Body className="py-3">
                <div 
                  className="markdown-content"
                  onClick={handleContentClick}
                  dangerouslySetInnerHTML={{ 
                    __html: processContentWithJargon(document.summaries[lang], lang)
                  }}
                />
              </Card.Body>
            </Card>
          </>
        ) : (
          <Alert variant="info">
            <h5>
              {isEnglishTab 
                ? t('summary.noSummary.title')
                : t('summary.noTranslatedSummary.title')}
            </h5>
            <p>
              {isEnglishTab
                ? t('summary.noSummary.message')
                : t('summary.noTranslatedSummary.message')}
            </p>
          </Alert>
        )}
        
        {/* Sections Accordion */}
        {hasSections ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'Key Insights' : t('summary.keyInsights')}
            </h4>
            <Accordion className="mb-3 summary-accordion">
              {document.sections[lang].map((section, index) => (
                <Accordion.Item key={index} eventKey={index.toString()}>
                  <Accordion.Header>
                    {section.displayName}
                  </Accordion.Header>
                  <Accordion.Body>
                    {section.pageNumbers && section.pageNumbers.length > 0 && (
                      <p className="text-muted mb-2">
                        <small>
                          {isEnglishTab ? 'The original content for this section can be found in your IEP document on Pages: ' : 'Páginas: '}
                          {Array.isArray(section.pageNumbers) 
                            ? section.pageNumbers.join(', ') 
                            : section.pageNumbers}
                        </small>
                      </p>
                    )}
                    <div 
                      className="markdown-content"
                      onClick={handleContentClick}
                      dangerouslySetInnerHTML={{ 
                        __html: processContentWithJargon(
                          section.content || t('summary.noContent'), 
                          lang
                        )
                      }}
                    />
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          </>
        ) : (
          <Alert variant="info">
            <h5>
              {isEnglishTab
                ? t('summary.noSections.title')
                : t('summary.noTranslatedSections.title')}
            </h5>
            <p>
              {isEnglishTab
                ? t('summary.noSections.message')
                : t('summary.noTranslatedSections.message')}
            </p>
          </Alert>
        )}
      </>
    );
  };

  // Check if document is processing
  const isProcessing = document && document.status === "PROCESSING";

  // Get tab title based on language code
  const getTabTitle = (languageCode: string) => {
    switch(languageCode) {
      case 'en': return t('summary.english');
      case 'es': return 'Español';
      case 'vi': return 'Tiếng Việt';
      case 'zh': return '中文';
      default: return languageCode.toUpperCase();
    }
  };

  // Loading state while translations are being loaded
  if (!translationsLoaded) {
    return (
      <Container className="summary-container mt-4 mb-5">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading translations...</span>
          </Spinner>
          <p className="mt-3">Loading translations...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="summary-container mt-3 mb-3">
      <div className="mt-2 text-start button-container">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          {t('summary.back')}
        </Button>
      </div>
      <Row className="mt-2">
        <Col>
          {error && <Alert variant="danger">{error}</Alert>}
          
          {initialLoading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">{t('summary.loading')}</span>
              </Spinner>
              <p className="mt-3">{t('summary.loading')}</p>
            </div>
          ) : !document ? (
            <Alert variant="info">
              {t('summary.noDocuments')}
            </Alert>
          ) : (
            <Card className="summary-card">
              <Card.Body className="summary-card-body pt-2 pb-0">
                <Row>
                  <Col md={12}>
                    {isProcessing ? (
                      <div className="text-center my-5">
                        <Spinner animation="border" variant="warning" role="status">
                          <span className="visually-hidden">Processing document...</span>
                        </Spinner>
                        <Alert variant="warning" className="mt-3">
                          <h5>{t('summary.processing.title')}</h5>
                          <p>{t('summary.processing.message')}</p>
                          <div className="text-start">
                            <p>{t('rights.description')}</p>
                            <ul className="mt-3 text-start">
                              <li className="mb-2">{t('rights.bulletPoints.1')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.2')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.3')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.4')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.5')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.6')}</li>
                            </ul>
                          </div>
                        </Alert>
                      </div>
                    ) : document.status === "FAILED" ? (
                      <Alert variant="danger">
                        <h5>{t('summary.failed.title')}</h5>
                        <p>{t('summary.failed.message')}</p>
                      </Alert>
                    ) : (
                      <>
                        <Tabs
                          activeKey={activeTab}
                          onSelect={(k) => k && setActiveTab(k)}
                          className="mb-2 mt-2 summary-tabs"
                        >
                          {/* Always show English tab */}
                          <Tab 
                            eventKey="en" 
                            title={t('summary.english')}
                          >
                            {renderTabContent('en')}
                          </Tab>
                          
                          {/* Show preferred language tab if content exists */}
                          {preferredLanguage !== 'en' && hasContent(preferredLanguage) && (
                            <Tab 
                              eventKey={preferredLanguage} 
                              title={
                                <span>
                                  <FontAwesomeIcon icon={faLanguage} className="me-1" />
                                  {getTabTitle(preferredLanguage)}
                                </span>
                              }
                            >
                              {renderTabContent(preferredLanguage)}
                            </Tab>
                          )}
                        </Tabs>
                        
                        {!hasContent('en') && !hasContent(preferredLanguage) && (
                          <Alert variant="info">
                            <h5>{t('summary.noContentAvailable.title')}</h5>
                            <p>{t('summary.noContentAvailable.message')}</p>
                          </Alert>
                        )}
                      </>
                    )}
                  </Col>
                </Row>
              </Card.Body>
              <Card.Header className="summary-card-header d-flex justify-content-between align-items-center">
                <div>
                  <FontAwesomeIcon icon={faFileAlt} className="me-2" />
                  {document.documentUrl ? getFileName(document.documentUrl) : 'Document'}
                </div>
                {document.status && renderStatusBadge(document.status)}
              </Card.Header>
            </Card>
          )}
        </Col>
      </Row>
      
      {/* Jargon Drawer */}
      <Offcanvas 
        show={showJargonDrawer} 
        onHide={() => setShowJargonDrawer(false)}
        placement="end"
        className="jargon-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{selectedJargon?.term}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <p>{selectedJargon?.definition}</p>
        </Offcanvas.Body>
      </Offcanvas>
    </Container>
  );
};

export default IEPSummarizationAndTranslation;