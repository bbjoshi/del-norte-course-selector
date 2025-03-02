// Mock implementation of Firestore for development
export class MockFirestore {
  private data: Record<string, Record<string, any>> = {
    users: {}
  };

  // Mock Firestore internal properties
  _delegate = {
    _databaseId: 'mock-db-id'
  };

  // Mock Firestore methods
  doc(collection: string, id: string) {
    console.log(`Mock Firestore: Accessing document ${collection}/${id}`);
    return {
      get: async () => this.getDoc(collection, id),
      set: async (data: any) => this.setDoc(collection, id, data),
      // Add other document methods as needed
      path: `${collection}/${id}`,
      id: id,
      parent: {
        id: collection
      }
    };
  }

  collection(path: string) {
    console.log(`Mock Firestore: Accessing collection ${path}`);
    return {
      doc: (id: string) => this.doc(path, id),
      path: path,
      id: path
    };
  }

  private async getDoc(collection: string, id: string) {
    if (!this.data[collection]) {
      this.data[collection] = {};
    }

    const docData = this.data[collection][id];
    console.log(`Mock Firestore: Getting document ${collection}/${id}`, docData);
    
    return {
      exists: () => !!docData,
      data: () => docData || null,
      id: id,
      ref: {
        path: `${collection}/${id}`
      }
    };
  }

  private async setDoc(collection: string, id: string, data: any) {
    if (!this.data[collection]) {
      this.data[collection] = {};
    }
    
    console.log(`Mock Firestore: Setting document ${collection}/${id}`, data);
    this.data[collection][id] = data;
    return true;
  }
}

export const mockFirestore = new MockFirestore();
