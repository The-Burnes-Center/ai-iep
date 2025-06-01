import { useEffect, useRef, useContext, useState } from 'react';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { IEPDocument } from '../../common/types';
import { usePollingManager } from './polling-utility';
import { AppContext } from '../../common/app-context';


interface UseDocumentFetchParams {
  translationsLoaded: boolean;
  document: IEPDocument;
  initialLoading: boolean;
  setDocument: React.Dispatch<React.SetStateAction<IEPDocument>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setInitialLoading: React.Dispatch<React.SetStateAction<boolean>>;
  processDocumentSections: (doc: any) => void;
}

export const useDocumentFetch = ({
  translationsLoaded,
  document,
  initialLoading,
  setDocument,
  setError,
  setInitialLoading,
  processDocumentSections
}: UseDocumentFetchParams) => {
  const isFirstRender = useRef<boolean>(true);

  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  

  const { pollingManager } = usePollingManager();

    const appContext = useContext(AppContext);
    const apiClient = new IEPDocumentClient(appContext);

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
          
          pollingManager.startPollingIfProcessing(retrievedDocument, () => {
            setRefreshCounter(prev => prev + 1);
          });
          
          if (retrievedDocument.status === "PROCESSED") {
            
            setDocument(prev => ({
              ...prev, 
              summaries: retrievedDocument.summaries,
              document_index: retrievedDocument.document_index
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
      pollingManager.stopPolling();
    };
  }, [refreshCounter, translationsLoaded]);
};