import './SummarizeTranslateAdvocateBanner.css';

const SummarizeTranslateAdvocateBanner: React.FC = () => {
    return (
        <div className='summarize-translate-advocate-banner-container'>

        <div className='summarize-translate-advocate-cards-container'>
            <div className='summarize-translate-advocate-card'>
                <img src="/images/Summarize_Illustration.png" alt="Summarize" className='summarize-translate-advocate-image' />
                <h2 className='summarize-translate-advocate-title'>Summarize</h2>
                <p className='summarize-translate-advocate-text'>
                    The tool will break down the key aspects of the IEP document into easy-to-understand language.
                </p>
            </div>
        
            <div className='summarize-translate-advocate-card'>
                <img src="/images/Translate_Illustration.png" alt="Summarize" className='summarize-translate-advocate-image' />
                <h2 className='summarize-translate-advocate-title'>Translate</h2>
                <p className='summarize-translate-advocate-text'>
                    AIEP can also translate the summaries of IEP documents into your language of choice.
                </p>
            </div>


            <div className='summarize-translate-advocate-card'>
                <img src="/images/Advocate_Illustration.png" alt="Summarize" className='summarize-translate-advocate-image' />
                <h2 className='summarize-translate-advocate-title'>Advocate</h2>
                <p className='summarize-translate-advocate-text'>
                    Advocate for your child’s education by exploring the IEP and understandingyour rights.
                </p>
            </div>   
        </div>
        
        </div>
    )
}

export default SummarizeTranslateAdvocateBanner;