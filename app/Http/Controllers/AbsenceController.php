<?php

namespace App\Http\Controllers;

use App\Models\Absence;
use Illuminate\Http\Request;


class AbsenceController extends Controller
{
    public function index()
    {
        return Absence::with('student')->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:students,id',
            'absence_entries' => 'required|array|min:1',
            'absence_entries.*.absence_date' => 'required|date',
            'absence_entries.*.session_name' => 'required|string|max:255',
            'reason' => 'required|string|max:255',
            'status' => 'required|string|max:255',
        ]);

        $createdAbsences = [];

        foreach ($request->absence_entries as $entry) {
            $createdAbsences[] = Absence::create([
                'student_id' => $request->student_id,
                'absence_date' => $entry['absence_date'],
                'session_name' => $entry['session_name'],
                'reason' => $request->reason,
                'status' => $request->status,
            ]);
        }

        return response()->json($createdAbsences, 201);
    }

    public function show($id)
    {
        return Absence::with('student')->findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $absence = Absence::findOrFail($id);

        $request->validate([
            'student_id' => 'required|exists:students,id',
            'absence_date' => 'required|date',
            'session_name' => 'required|string|max:255',
            'reason' => 'required|string|max:255',
            'status' => 'required|string|max:255',
        ]);

        $absence->update([
            'student_id' => $request->student_id,
            'absence_date' => $request->absence_date,
            'session_name' => $request->session_name,
            'reason' => $request->reason,
            'status' => $request->status,
        ]);

        return response()->json($absence);
    }

    public function destroy($id)
    {
        $absence = Absence::findOrFail($id);
        $absence->delete();

        return response()->json([
            'message' => 'Absence deleted successfully'
        ]);
    }
}
