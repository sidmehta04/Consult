import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FilePenLine, FileX, XCircle, AlertCircle } from "lucide-react";

const CaseStatusDialog = ({ 
  open, 
  onOpenChange, 
  onSubmit, 
  statusType, 
  caseData 
}) => {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset note when dialog opens
  useEffect(() => {
    if (open) {
      setNote("");
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!note.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      // Call the parent's onSubmit function
      await onSubmit(note);
      
      // Note: don't call onOpenChange here - the parent component will handle this
      setNote("");
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting case status update:", error);
      setIsSubmitting(false);
    }
  };
  
  const getIcon = () => {
    if (statusType === "incomplete") {
      return <FileX className="h-5 w-5 text-amber-500 mr-2" />;
    } else if (statusType === "doc_presc") {
      return <FilePenLine className="h-5 w-5 text-purple-500 mr-2" />;
    }
    return <AlertCircle className="h-5 w-5 text-red-500 mr-2" />;
  };
  
  const getTitle = () => {
    if (statusType === "incomplete") {
      return "Mark Case as Incomplete";
    } else if (statusType === "doc_presc") {
      return "Mark as Doctor Prescription";
    }
    return "Change Case Status";
  };
  
  const getDescription = () => {
    if (statusType === "incomplete") {
      return "Please provide a reason why this case is being marked as incomplete.";
    } else if (statusType === "doc_presc") {
      return "Please provide details about the prescription for this case.";
    }
    return "Please provide additional information about this status change.";
  };
  
  const getButtonText = () => {
    if (statusType === "incomplete") {
      return "Mark as Incomplete";
    } else if (statusType === "doc_presc") {
      return "Mark as Doc Prescription";
    }
    return "Submit";
  };
  
  const getButtonColor = () => {
    if (statusType === "incomplete") {
      return "bg-amber-600 hover:bg-amber-700";
    } else if (statusType === "doc_presc") {
      return "bg-purple-600 hover:bg-purple-700";
    }
    return "bg-primary hover:bg-primary/90";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {caseData && (
          <div className="space-y-3 py-3 border-y border-gray-100">
            <div className="flex items-center">
              <span className="font-medium">Patient:</span>
              <span className="ml-2">{caseData.patientName}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium">EMR:</span>
              <span className="ml-2">{caseData.emrNumber}</span>
            </div>
            <div className="flex items-start">
              <span className="font-medium">Complaint:</span>
              <span className="ml-2">{caseData.chiefComplaint}</span>
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="status-note" className="text-sm">
              {statusType === "incomplete" 
                ? "Reason for Incomplete Status" 
                : statusType === "doc_presc" 
                  ? "Prescription Details" 
                  : "Additional Notes"}
            </Label>
            <Textarea
              id="status-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                statusType === "incomplete"
                  ? "e.g., Missing patient information, need further details, etc."
                  : statusType === "doc_presc"
                    ? "e.g., Prescribed medication details, dosage, etc."
                    : "Please provide details..."
              }
              className="min-h-[120px]"
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
            disabled={isSubmitting}
          >
            <XCircle className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !note.trim()}
            className={getButtonColor()}
            type="button"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                {getIcon()}
                {getButtonText()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CaseStatusDialog;