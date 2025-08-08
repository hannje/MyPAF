import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SignaturePad from 'signature_pad'; // Import the library

import SignatureCanvas from 'react-signature-canvas'; // <<< 2. Import the component

import './PafApprovalPage.css'; // Create this CSS file

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443') + '/api';

function PafApprovalPage() {
    const { pafDbId } = useParams(); // Get pafDbId from URL
    const navigate = useNavigate();
    const signaturePadRef = useRef(null);
    const canvasRef = useRef(null);

    const [pafDetails, setPafDetails] = useState(null);
    const [loadingPaf, setLoadingPaf] = useState(true);
    const [signerName, setSignerName] = useState('');
    const [signerTitle, setSignerTitle] = useState('');
    const [signatureMethod, setSignatureMethod] = useState('type'); // 'type', 'draw', 'upload'
    const [typedSignature, setTypedSignature] = useState('');
    const [typeConsent, setTypeConsent] = useState(false);
    const [uploadedSignatureFile, setUploadedSignatureFile] = useState(null);
    const [rtdAcknowledged, setRtdAcknowledged] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');
    const [submitError, setSubmitError] = useState('');

    const [agreedToTerms, setAgreedToTerms] = useState(false);
 
    const [signatureDataUrl, setSignatureDataUrl] = useState(null); // <<< 4. State to hold the final signature image data
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');


    const [drawnSignatureData, setDrawnSignatureData] = useState(null);

 // --- Ref for the signature canvas ---
    const sigCanvasRef = useRef({}); // <<< 5. Create a ref



    useEffect(() => {

          console.log(`approval page: pafDbId from useParams is: '${pafDbId}'`); // <<< LOG THIS

        const fetchPafForApproval = async () => {
            setLoadingPaf(true);
            setSubmitError('');
            try {
                const urlToFetch = `${API_BASE_URL}/pafs/${pafDbId}`; // <<< IS THIS THE CORRECT ENDPOINT?
                console.log(`PafApprovalPage: Fetching PAF for approval from URL: ${urlToFetch}`); // <<< LOG 1
                
                const response = await axios.get(urlToFetch, {
                withCredentials: true, // If session/auth is needed to view PAF before approval
                });
                console.log("PafApprovalPage: PAF data for approval received:", response.data); // <<< LOG 2


                setPafDetails(response.data);
                if (response.data.status !== 'PENDING_LIST_OWNER_APPROVAL') {
                    setSubmitError(`This PAF is not currently awaiting your approval. Current status: ${response.data.status.replace(/_/g, ' ')}`);
                    // Optionally redirect or disable form
                }
            } catch (err) {
                console.error("Error fetching PAF for approval:", err);
                setSubmitError(err.response?.data?.error || "Could not load PAF details. Invalid link or PAF not found.");
            } finally {
                setLoadingPaf(false);
            }
        };
        if (pafDbId) {
            fetchPafForApproval();
        }
    }, [pafDbId]);

    useEffect(() => {
        if (canvasRef.current && signatureMethod === 'draw') {
            const canvas = canvasRef.current;
            // Adjust canvas size based on its displayed size for better drawing
            const ratio =  Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);

            signaturePadRef.current = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)',
                penColor: 'rgb(0, 0, 100)'
            });
            return () => {
                if (signaturePadRef.current) {
                    signaturePadRef.current.off(); // Clean up event listeners
                }
            };
        }
    }, [signatureMethod]); // Re-initialize if signatureMethod changes to 'draw'


   
    const clearSignaturePad = () => {
        if (signaturePadRef.current) {
            signaturePadRef.current.clear();
        }
    };
    const handleSignatureMethodChange = (method) => {
        setSignatureMethod(method);
        // Clear other methods' data
        setTypedSignature('');
        setTypeConsent(false);
        if (signaturePadRef.current && method !== 'draw') signaturePadRef.current.clear();
        setUploadedSignatureFile(null);
        if (document.getElementById('signature_upload')) document.getElementById('signature_upload').value = '';
    };


const completeSignature = () => {
        if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
            const dataUrl = sigCanvasRef.current.toDataURL('image/png');
            setDrawnSignatureData(dataUrl); // Save the signature data to state
            console.log("Signature captured.");
        } else {
            alert("Please provide a signature before completing.");
        }
    };

  const clearSignature = () => {
    sigCanvasRef.current.clear(); // Use the ref to call the clear method
    setSignatureDataUrl(null); // Clear the saved signature data
  };

const handleSignAndSubmit = async () => {
    // This function is now called by the final "Submit PAF" button
    if (!agreedToTerms || !signerName || !signerTitle) {
      setError("Please fill in your name, title, and agree to the terms.");
      return;
    }
    if (!signatureDataUrl) { // <<< Check if signature has been "completed"
      setError("Please complete your signature before submitting.");
      return;
    }


    setIsLoading(true);
    setError('');
    try {
      const url = `${API_BASE_URL}/api/pafs/${pafDbId}/listowner-signature`;
      let payload = {
        signerName: signerName,
        signerTitle: signerTitle,
        signatureMethod: 'DRAWN_SIGNATURE',
        signatureData: signatureDataUrl, // <<< Send the base64 image data
      };

      if(typedSignature)
      {
        payload.signatureMethod = 'TYPED_SIGNATURE';
        payload.signatureData = typedSignature; // Use typed signature if provided
      }

      console.table(payload); // Debug log

      const response = await axios.post(url, payload, { withCredentials: true });
      
      alert("Thank you for signing the PAF. The Licensee Admin has been notified.");
      setPafDetails(response.data.paf); // Update with new status

    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit signature.");
    } finally {
      setIsLoading(false);
    }
  };



 const handleFileChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            setUploadedSignatureFile(event.target.files[0]);
        } else {
            setUploadedSignatureFile(null);
        }
    };


const canSubmit = () => {
        // Basic requirements that are always needed
        if (!rtdAcknowledged || !signerName || !signerTitle) {
            return false;
        }

        // Check for signature based on the selected method
        if (signatureMethod === 'type') {
            // For 'type', we need the typed signature and the consent checkbox
        
            console.log("Typed signature:", typedSignature, "Consent:", typeConsent); // Debug log
            return typedSignature && typeConsent;
        } 
        else if (signatureMethod === 'draw') {
            // For 'draw', we now check if the signature has been "completed"
            // and saved into our drawnSignatureData state.
            return !!drawnSignatureData; // The '!!' converts a value to a boolean (true if not null/undefined, false if it is)
        } else if (signatureMethod === 'upload') {
            // For 'upload', we check if a file has been selected
            return !!uploadedSignatureFile;
        }

        // If no signature method is selected or something is wrong, disable submission
        return false;
    };

    

    const handleSubmitApproval = async (e) => {
        e.preventDefault();
        if (!canSubmit()) {
            setSubmitError("Please complete all required fields and provide your signature.");
            return;
        }
        setIsSubmitting(true);
        setSubmitMessage('');
        setSubmitError('');

        let signatureDataValue = '';
        let signatureDataForPayload = null;
        let signatureMethodForPayload = signatureMethod;



   if (signatureMethod === 'type') {
            // ... your existing logic for typed signature ...
            signatureDataForPayload = `typed:${typedSignature}`;
        } else if (signatureMethod === 'draw') {
            // Check if the canvas is empty before getting the data
            if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
                // Get the signature as a base64 encoded PNG image data URL
                signatureDataForPayload = sigCanvasRef.current.toDataURL('image/png');
               signatureDataValue = sigCanvasRef.current.toDataURL('image/png');


            } else {
                alert("Please provide a signature by drawing it before submitting.");
                return; // Stop submission if drawing is selected but canvas is empty
            }
        } else if (signatureMethod === 'upload') {
            // ... your existing logic for file upload ...
            // You would need to handle the file upload and get a URL or base64 string here
            // For now, let's assume it sets a variable.
            // signatureDataForPayload = uploadedFileBase64; 
        }

        let payload = {
            signerName,
            signerTitle,
            signatureMethod,
            signatureData: signatureDataValue,
            rtdAcknowledged
        };
        if(typedSignature)
        {
            payload.signatureMethod = 'TYPED_SIGNATURE';
            payload.signatureData = typedSignature; // Use typed signature if provided
        }

      console.table(payload); // Debug log




        try {
            // If signatureMethod is 'upload' and you want to send the actual file,
            // you need to use FormData. This example doesn't fully implement file upload to backend.
            // Example with FormData:
            // if (signatureMethod === 'upload' && uploadedSignatureFile) {
            //     const formData = new FormData();
            //     formData.append('signerName', signerName);
            //     formData.append('signerTitle', signerTitle);
            //     formData.append('signatureMethod', signatureMethod);
            //     formData.append('rtdAcknowledged', rtdAcknowledged);
            //     formData.append('signatureFile', uploadedSignatureFile); // The actual file
            //     // signatureData in this case might be filename or not sent if file is the primary data
            //     response = await axios.post(`${API_BASE_URL}/pafs/${pafDbId}/approve`, formData, {
            //         headers: { 'Content-Type': 'multipart/form-data' }
            //     });
            // } else {
            //     response = await axios.post(`${API_BASE_URL}/pafs/${pafDbId}/approve`, payload);
            // }
            const response = await axios.post(`${API_BASE_URL}/pafs/${pafDbId}/approve`, payload);

            setSubmitMessage(response.data.message || "PAF Approved Successfully!");
            // Stay on current page - let user decide whether to navigate back to dashboard

        } catch (err) {
            setSubmitError(err.response?.data?.error || "Failed to submit approval. Please try again.");
            console.error("Error submitting PAF approval:", err);
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loadingPaf) return <div className="loading-container"><p>Loading PAF details...</p></div>;
    if (!pafDetails && !loadingPaf) return <div className="error-container"><p>Could not load PAF details. The link may be invalid or the PAF does not exist.</p></div>;

    console.log("PafApprovalPage: PAF details loaded:", pafDetails); // Debug log for loaded PAF

    return (
        <div className="paf-approval-container">
            <h1>PAF Approval Request</h1>
            <p className="paf-id-display">Reviewing PAF (Internal ID: {pafDetails?.internalDbId} / Licensee PAF ID: {pafDetails?.pafIdDisplay || 'Pending'})</p>

            {pafDetails && (
                <div className="section paf-info-display">
                    <h2>PAF & Party Details</h2>
                    <dl>
                        <dt>List Owner:</dt><dd>{pafDetails.listOwnerId || 'N/A'}</dd>
                        <dt>Processing Licensee:</dt><dd>{pafDetails.licenseeId || 'N/A'}</dd>
                        {pafDetails.brokerNames && <><dt>Broker(s)/Agent(s):</dt><dd>{pafDetails.brokerNames}</dd></>}
                        {pafDetails.listAdminName && <><dt>List Administrator:</dt><dd>{pafDetails.listAdminName}</dd></>}
                        <dt>Date Initiated:</dt><dd>{pafDetails.dateSigned? new Date(pafDetails.dateSigned).toLocaleDateString() : 'N/A'}</dd>
                        <dt>Current Status:</dt><dd style={{fontWeight: 'bold'}}>{pafDetails.status ? pafDetails.status.replace(/_/g, ' ') : 'N/A'}</dd>
                    </dl>
                </div>
            )}

            {submitMessage && (
                <div className="message success form-message">
                    <p><strong>{submitMessage}</strong></p>
                    <div style={{marginTop: '15px', textAlign: 'center'}}>
                        <p>Thank you for approving this PAF! You can now:</p>
                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'}}>
                            <button 
                                onClick={() => window.close()} 
                                className="nav-button" 
                                style={{backgroundColor: '#28a745', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                            >
                                Close Window
                            </button>
                            <button 
                                onClick={() => window.location.href = '/'} 
                                className="nav-button" 
                                style={{backgroundColor: '#007bff', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {submitError && <div className="message error form-message">{submitError}</div>}

            {pafDetails && pafDetails.status === 'PENDING_LIST_OWNER_APPROVAL' && !submitMessage && (
                <form id="paf-approval-form" onSubmit={handleSubmitApproval}>
                    <div className="section acknowledgment-box">
                        <label htmlFor="rtd_acknowledged">
                            <input type="checkbox" id="rtd_acknowledged" name="rtdAcknowledged" checked={rtdAcknowledged} onChange={(e) => setRtdAcknowledged(e.target.checked)} />
                            I acknowledge receipt and review of the NCOALink® Required Text Document (RTD).
                        <a 
                            href="/data/595_SVC-PROV-RTD.pdf"  // Path is relative to the public folder root
                            target="_blank" 
                            rel="noopener noreferrer" // Good security practice for target="_blank"
                            className="rtd-link"
                            >
                            (View Service Provider RTD)
                            </a>

                            <span className="required-indicator">*</span>
                        </label>
                    </div>

                    <div className="section terms-text">
                        <h2>Terms of Use Acknowledgment</h2>
                        <p>By providing my signature below, I, as an authorized representative of <strong>{pafDetails.listOwnerName || 'the List Owner company'}</strong>, acknowledge that the sole purpose of the NCOALink® service is to provide a mailing list correction service for lists used in preparation of mailings. I understand that NCOALink® data and processing results may not be used to create or maintain new movers' lists or for any purpose other than mailing list correction for the designated List Owner.</p>
                    </div>


                    <div className="section signature-section">
                        <h2>Signer Information & Signature</h2>
                        <div className="form-group">
                            <label htmlFor="signerName">Your Full Printed Name<span className="required-indicator">*</span></label>
                            <input type="text" id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="signerTitle">Your Official Title<span className="required-indicator">*</span></label>
                            <input type="text" id="signerTitle" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} required />
                        </div>

                        <label className="signature-method-label">Provide Your Signature Using One Method Below<span className="required-indicator">*</span></label>
                        <div className="signature-tabs">
                            <button type="button" className={`tab-button ${signatureMethod === 'type' ? 'active' : ''}`} onClick={() => handleSignatureMethodChange('type')}>Type Signature</button>
                            <button type="button" className={`tab-button ${signatureMethod === 'draw' ? 'active' : ''}`} onClick={() => handleSignatureMethodChange('draw')}>Draw Signature</button>
                            <button type="button" className={`tab-button ${signatureMethod === 'upload' ? 'active' : ''}`} onClick={() => handleSignatureMethodChange('upload')}>Upload Signature</button>
                        </div>

                        <div id="type-tab" className={`tab-content ${signatureMethod === 'type' ? 'active' : ''}`}>
                            <label htmlFor="typed_signature">Type your full name exactly as printed above:</label>
                            <input type="text" id="typed_signature" value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} />
                            <p className="signature-note">
                                <input type="checkbox" id="type_consent" checked={typeConsent} onChange={(e) => setTypeConsent(e.target.checked)} className="consent-checkbox" />
                                By checking this box and typing my name, I agree that this constitutes my legally binding electronic signature.
                            </p>
                        </div>

                        <div id="draw-tab" className={`tab-content ${signatureMethod === 'draw' ? 'active' : ''}`}>
                            <label>Use your mouse or touchscreen to draw your signature:</label>
                            
                            {/* --- REPLACE THIS: --- */}
                            {/* <canvas ref={canvasRef} id="signature-pad-canvas" ...></canvas> */}

                            {/* --- WITH THIS: --- */}
                            <div style={{ border: '1px dashed #aaa', width: '450px', height: '180px' }}>
                                <SignatureCanvas
                                    ref={sigCanvasRef} // Attach the ref here
                                    penColor='black'
                                    canvasProps={{ 
                                        width: 450, 
                                        height: 180, 
                                        className: 'signature-pad-canvas' 
                                    }}
                                />
                            </div>
                            
                            <button type="button" className="clear-sig" onClick={clearSignaturePad}>Clear</button>
  
                             <button type="button" onClick={completeSignature}>
                                    Accept & Complete Signature
                                </button>
  
  
                            <p className="signature-note">Drawing your signature constitutes your legally binding electronic signature.</p>
                        </div>
 
                        <div id="upload-tab" className={`tab-content ${signatureMethod === 'upload' ? 'active' : ''}`}>
                            <label htmlFor="signature_upload">Upload an image file of your signature (PNG, JPG, GIF):</label>
                            <input type="file" id="signature_upload" name="signatureFile" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" />
                            <p className="signature-note">Max size: 2MB. Uploading your signature image constitutes your legally binding electronic signature.</p>
                            {uploadedSignatureFile && <p>Selected file: {uploadedSignatureFile.name}</p>}
                        </div>
                    </div>

                    <div className="button-container">
                        <button type="submit" disabled={isSubmitting || !canSubmit()}>
                            {isSubmitting ? 'Submitting...' : 'Approve & Submit Signature'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default PafApprovalPage;