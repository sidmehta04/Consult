import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  UserMinus,
  Pill,
  AlertCircle,
  CheckCircle,
  Search,
  X,
} from 'lucide-react';
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { firestore } from '../../firebase';

const DoctorUserManagement = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availablePharmacists, setAvailablePharmacists] = useState([]);
  const [assignedPharmacists, setAssignedPharmacists] = useState([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedPharmacist, setSelectedPharmacist] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Fetch available and assigned pharmacists
  useEffect(() => {
    const fetchPharmacists = async () => {
      try {
        setLoading(true);
        
        // Get all pharmacists
        const pharmacistsQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'pharmacist')
        );
        
        const pharmacistsSnapshot = await getDocs(pharmacistsQuery);
        const allPharmacists = pharmacistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          name: doc.data().displayName || doc.data().name || doc.data().email,
          specialty: doc.data().specialization || 'General Pharmacy'
        }));

        // Get pharmacists assigned to this doctor (now using assignedDoctorIds array)
        const assignedIds = new Set();
        const assigned = [];
        const available = [];

        allPharmacists.forEach(pharmacist => {
          const assignedDoctorIds = pharmacist.assignedDoctorIds || [];
          if (assignedDoctorIds.includes(currentUser.uid)) {
            // This pharmacist is assigned to current doctor
            if (!assignedIds.has(pharmacist.id)) {
              assignedIds.add(pharmacist.id);
              assigned.push(pharmacist);
            }
          } else {
            // This pharmacist is available for assignment (may be assigned to other doctors)
            available.push(pharmacist);
          }
        });

        setAssignedPharmacists(assigned);
        setAvailablePharmacists(available);
        
      } catch (err) {
        console.error('Error fetching pharmacists:', err);
        setError('Failed to load pharmacists data');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser?.uid) {
      fetchPharmacists();
    }
  }, [currentUser?.uid]);

  // Real-time updates for all pharmacists
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Listen to all pharmacists to get real-time updates
    const allPharmacistsQuery = query(
      collection(firestore, 'users'),
      where('role', '==', 'pharmacist')
    );

    const unsubscribe = onSnapshot(allPharmacistsQuery, (snapshot) => {
      const allPharmacists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().displayName || doc.data().name || doc.data().email,
        specialty: doc.data().specialization || 'General Pharmacy'
      }));

      // Separate assigned and available pharmacists
      const assignedIds = new Set();
      const assigned = [];
      const available = [];

      allPharmacists.forEach(pharmacist => {
        const assignedDoctorIds = pharmacist.assignedDoctorIds || [];
        if (assignedDoctorIds.includes(currentUser.uid)) {
          // This pharmacist is assigned to current doctor
          if (!assignedIds.has(pharmacist.id)) {
            assignedIds.add(pharmacist.id);
            assigned.push(pharmacist);
          } else {
            console.warn('Duplicate assigned pharmacist detected:', pharmacist.id);
          }
        } else {
          // This pharmacist is available for assignment (may be assigned to other doctors)
          available.push(pharmacist);
        }
      });
      
      setAssignedPharmacists(assigned);
      setAvailablePharmacists(available);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const assignPharmacist = async (pharmacistId) => {
    try {
      setUpdating(true);
      setError('');
      
      // Check if pharmacist is already assigned to prevent duplicates
      if (assignedPharmacists.some(p => p.id === pharmacistId)) {
        setError('Pharmacist is already assigned to you');
        setUpdating(false);
        return;
      }
      
      // Get current pharmacist data to update assignedDoctorIds array
      const pharmacistRef = doc(firestore, 'users', pharmacistId);
      const pharmacistDoc = await getDocs(query(
        collection(firestore, 'users'),
        where('__name__', '==', pharmacistId)
      ));
      
      if (pharmacistDoc.empty) {
        setError('Pharmacist not found');
        setUpdating(false);
        return;
      }
      
      const currentData = pharmacistDoc.docs[0].data();
      const currentAssignedDoctorIds = currentData.assignedDoctorIds || [];
      
      // Add current doctor to the array if not already present
      if (!currentAssignedDoctorIds.includes(currentUser.uid)) {
        await updateDoc(pharmacistRef, {
          assignedDoctorIds: [...currentAssignedDoctorIds, currentUser.uid],
          // Keep backward compatibility
          assignedDoctorId: currentAssignedDoctorIds.length === 0 ? currentUser.uid : currentData.assignedDoctorId,
          assignedDoctorName: currentUser.displayName || currentUser.name || currentUser.email,
          assignedAt: new Date()
        });
      }

      // The real-time listener will handle updating the state
      // Remove manual state updates to prevent conflicts

      setSuccess('Pharmacist assigned successfully!');
      setShowAssignDialog(false);
      setSelectedPharmacist(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error assigning pharmacist:', err);
      setError('Failed to assign pharmacist');
    } finally {
      setUpdating(false);
    }
  };

  const unassignPharmacist = async (pharmacistId) => {
    try {
      setUpdating(true);
      setError('');
      
      // Get current pharmacist data to update assignedDoctorIds array
      const pharmacistRef = doc(firestore, 'users', pharmacistId);
      const pharmacistDoc = await getDocs(query(
        collection(firestore, 'users'),
        where('__name__', '==', pharmacistId)
      ));
      
      if (pharmacistDoc.empty) {
        setError('Pharmacist not found');
        setUpdating(false);
        return;
      }
      
      const currentData = pharmacistDoc.docs[0].data();
      const currentAssignedDoctorIds = currentData.assignedDoctorIds || [];
      
      // Remove current doctor from the array
      const updatedAssignedDoctorIds = currentAssignedDoctorIds.filter(id => id !== currentUser.uid);
      
      await updateDoc(pharmacistRef, {
        assignedDoctorIds: updatedAssignedDoctorIds,
        // Update backward compatibility field
        assignedDoctorId: updatedAssignedDoctorIds.length > 0 ? updatedAssignedDoctorIds[0] : null,
        assignedDoctorName: updatedAssignedDoctorIds.length > 0 ? currentData.assignedDoctorName : null,
        assignedAt: updatedAssignedDoctorIds.length > 0 ? currentData.assignedAt : null
      });

      // The real-time listener will handle updating the state
      // Remove manual state updates to prevent conflicts

      setSuccess('Pharmacist unassigned successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error unassigning pharmacist:', err);
      setError('Failed to unassign pharmacist');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddPharmacistClick = () => {
    setShowSearchDialog(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchPharmacists = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      
      // Get all pharmacists
      const pharmacistsQuery = query(
        collection(firestore, 'users'),
        where('role', '==', 'pharmacist')
      );
      
      const pharmacistsSnapshot = await getDocs(pharmacistsQuery);
      const allPharmacists = pharmacistsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().displayName || doc.data().name || doc.data().email,
        specialty: doc.data().specialization || 'General Pharmacy',
        assignedDoctorIds: doc.data().assignedDoctorIds || []
      }));

      // Filter by search query (name, email, specialty)
      const filtered = allPharmacists.filter(pharmacist => {
        const search = searchTerm.toLowerCase();
        return (
          pharmacist.name.toLowerCase().includes(search) ||
          pharmacist.email?.toLowerCase().includes(search) ||
          pharmacist.specialty.toLowerCase().includes(search)
        );
      });

      // Remove already assigned pharmacists
      const assignedIds = new Set(assignedPharmacists.map(p => p.id));
      const available = filtered.filter(p => !assignedIds.has(p.id));

      setSearchResults(available);
    } catch (err) {
      console.error('Error searching pharmacists:', err);
      setError('Failed to search pharmacists');
    } finally {
      setSearching(false);
    }
  };

  const handleAssignClick = (pharmacist) => {
    setSelectedPharmacist(pharmacist);
    setShowAssignDialog(true);
    setShowSearchDialog(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-100 shadow-md">
        <CardHeader className="pb-4 bg-blue-50">
          <CardTitle className="flex items-center text-xl">
            <Users className="h-5 w-5 mr-2" />
            Pharmacist Management
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assigned Pharmacists */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Pill className="h-5 w-5 text-green-600 mr-2" />
                Assigned Pharmacists ({assignedPharmacists.length})
              </h3>
              
              <div className="space-y-3">
                {assignedPharmacists.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No pharmacists assigned</p>
                    <p className="text-gray-400 text-sm">Assign pharmacists to help with prescriptions</p>
                  </div>
                ) : (
                  assignedPharmacists.map(pharmacist => (
                    <div key={pharmacist.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Pill className="h-4 w-4 text-green-600 mr-2" />
                            <h4 className="font-semibold text-gray-800">{pharmacist.name}</h4>
                            <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">
                              Assigned
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{pharmacist.specialty}</p>
                          <p className="text-xs text-gray-500">
                            Availability: {pharmacist.availabilityStatus || 'Available'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unassignPharmacist(pharmacist.id)}
                          disabled={updating}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <UserMinus className="h-4 w-4 mr-1" />
                          Unassign
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Pharmacist */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <UserPlus className="h-5 w-5 text-blue-600 mr-2" />
                Add Pharmacist
              </h3>
              
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <UserPlus className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">Search and assign pharmacists to your practice</p>
                <Button
                  onClick={handleAddPharmacistClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search Pharmacists
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Confirmation Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserPlus className="h-5 w-5 text-blue-600 mr-2" />
              Assign Pharmacist
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to assign this pharmacist to yourself?
            </DialogDescription>
          </DialogHeader>

          {selectedPharmacist && (
            <div className="py-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Pill className="h-4 w-4 text-blue-600 mr-2" />
                  <h4 className="font-semibold text-gray-800">{selectedPharmacist.name}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-1">{selectedPharmacist.specialty}</p>
                <p className="text-xs text-gray-500">
                  Current Status: {selectedPharmacist.availabilityStatus || 'Available'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setSelectedPharmacist(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPharmacist && assignPharmacist(selectedPharmacist.id)}
              disabled={updating || !selectedPharmacist}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Pharmacist
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Pharmacists Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Search className="h-5 w-5 text-blue-600 mr-2" />
              Search Pharmacists
            </DialogTitle>
            <DialogDescription>
              Search for pharmacists by name, email, or specialty to assign to your practice.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or specialty..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchPharmacists(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {searching ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">Searching...</span>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No pharmacists found</p>
                  <p className="text-gray-400 text-sm">Try different search terms</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map(pharmacist => (
                    <div key={pharmacist.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Pill className="h-4 w-4 text-blue-600 mr-2" />
                            <h4 className="font-semibold text-gray-800">{pharmacist.name}</h4>
                            {(pharmacist.assignedDoctorIds?.length > 0 || pharmacist.assignedDoctorId) && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {pharmacist.assignedDoctorIds?.length || 1} doctor(s)
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{pharmacist.specialty}</p>
                          <p className="text-xs text-gray-500">
                            {pharmacist.email} • Status: {pharmacist.availabilityStatus || 'Available'}
                          </p>
                          {(pharmacist.assignedDoctorIds?.length > 0 || pharmacist.assignedDoctorId) && (
                            <p className="text-xs text-blue-600 mt-1">
                              Currently assigned to other doctor(s)
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignClick(pharmacist)}
                          disabled={updating}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Start typing to search pharmacists</p>
                  <p className="text-gray-400 text-sm">Search by name, email, or specialty</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSearchDialog(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorUserManagement;