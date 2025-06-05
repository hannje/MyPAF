import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SignaturePad from 'signature_pad'; // Import the library
import './PafApprovalPage.css'; // Create this CSS file

const API_BASE_URL = 'http://localhost:3001/api';

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

    useEffect(() => {
        const fetchPafForApproval = async () => {
            setLoadingPaf(true);
            setSubmitError('');
            try {
                console.log("Fetched PAF for pafDbId:", pafDbId);

                const response = await axios.get(`${API_BASE_URL}/pafs/${pafDbId}/for-approval`);
                console.log("Fetched PAF for approval:", response.data);


                setPafDetails(response.data);
                if (response.data.status !== 'PENDING_LIST_OWNER_SIGNATURE') {
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

    const handleFileChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            setUploadedSignatureFile(event.target.files[0]);
        } else {
            setUploadedSignatureFile(null);
        }
    };

    const canSubmit = () => {
        if (!rtdAcknowledged || !signerName || !signerTitle) return false;
        if (signatureMethod === 'type' && (!typedSignature || !typeConsent)) return false;
        if (signatureMethod === 'draw' && (!signaturePadRef.current || signaturePadRef.current.isEmpty())) return false;
        if (signatureMethod === 'upload' && !uploadedSignatureFile) return false;
        if (pafDetails && pafDetails.status !== 'PENDING_LIST_OWNER_SIGNATURE') return false; // Don't allow submit if not in correct status
        return true;
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
        if (signatureMethod === 'type') {
            signatureDataValue = typedSignature;
        } else if (signatureMethod === 'draw' && signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
            signatureDataValue = signaturePadRef.current.toDataURL('image/png'); // Get as base64 PNG
        } else if (signatureMethod === 'upload' && uploadedSignatureFile) {
            // For upload, we'd typically send FormData.
            // For simplicity here, if you store file path, backend needs to handle upload.
            // If storing base64, frontend needs to read file as base64.
            // Let's assume backend stores a reference or if it's small, base64
            // This example will just send the file name for now if not handling actual upload here
            // To send actual file, use FormData. For now, let's simulate sending file name.
            // Or for base64:
            // const reader = new FileReader();
            // reader.readAsDataURL(uploadedSignatureFile);
            // reader.onloadend = () => { signatureDataValue = reader.result; /* then submit */ };
            // For now, we'll just pass a placeholder for upload.
            // A real implementation would use FormData for file uploads.
            // For this example, let's assume we're just noting the method and backend might expect file separately or path.
            // If your backend expects base64 for uploads too, you need to implement file to base64 conversion here.
            signatureDataValue = `Uploaded: ${uploadedSignatureFile.name}`; // Placeholder for now
        }


        const payload = {
            signerName,
            signerTitle,
            signatureMethod,
            signatureData: signatureDataValue,
            rtdAcknowledged
        };

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
            // Optionally navigate away or disable form further
            setTimeout(() => navigate('/dashboard-thank-you'), 3000); // Redirect to a thank you or dashboard

        } catch (err) {
            setSubmitError(err.response?.data?.error || "Failed to submit approval. Please try again.");
            console.error("Error submitting PAF approval:", err);
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loadingPaf) return <div className="loading-container"><p>Loading PAF details...</p></div>;
    if (!pafDetails && !loadingPaf) return <div className="error-container"><p>Could not load PAF details. The link may be invalid or the PAF does not exist.</p></div>;


    return (
        <div className="paf-approval-container">
            <h1>PAF Approval Request</h1>
            <p className="paf-id-display">Reviewing PAF (Internal ID: {pafDetails?.internalDbId} / Licensee PAF ID: {pafDetails?.pafIdDisplay || 'Pending'})</p>

            {pafDetails && (
                <div className="section paf-info-display">
                    <h2>PAF & Party Details</h2>
                    <dl>
                        <dt>List Owner:</dt><dd>{pafDetails.listOwnerName || 'N/A'}</dd>
                        <dt>Processing Licensee:</dt><dd>{pafDetails.licenseeName || 'N/A'}</dd>
                        {pafDetails.brokerNames && <><dt>Broker(s)/Agent(s):</dt><dd>{pafDetails.brokerNames}</dd></>}
                        {pafDetails.listAdminName && <><dt>List Administrator:</dt><dd>{pafDetails.listAdminName}</dd></>}
                        <dt>Date Initiated:</dt><dd>{pafDetails.date_issued ? new Date(pafDetails.date_issued).toLocaleDateString() : 'N/A'}</dd>
                        <dt>Current Status:</dt><dd style={{fontWeight: 'bold'}}>{pafDetails.status ? pafDetails.status.replace(/_/g, ' ') : 'N/A'}</dd>
                    </dl>
                </div>
            )}

            {submitMessage && <div className="message success form-message">{submitMessage}</div>}
            {submitError && <div className="message error form-message">{submitError}</div>}

            {pafDetails && pafDetails.status === 'PENDING_LIST_OWNER_SIGNATURE' && !submitMessage && (
                <form id="paf-approval-form" onSubmit={handleSubmitApproval}>
                    <div className="section acknowledgment-box">
                        <label htmlFor="rtd_acknowledged">
                            <input type="checkbox" id="rtd_acknowledged" name="rtdAcknowledged" checked={rtdAcknowledged} onChange={(e) => setRtdAcknowledged(e.target.checked)} />
                            I acknowledge receipt and review of the NCOALink® Required Text Document (RTD).
                            <a href="/path/to/your/rtd_for_service_provider.pdf" target="_blank" className="rtd-link">(View Document)</a>
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
                            <canvas ref={canvasRef} id="signature-pad-canvas" width="450" height="180" style={{border: '1px dashed #aaa', touchAction: 'none'}}></canvas>
                            <button type="button" className="clear-sig" onClick={clearSignaturePad}>Clear</button>
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