import {FException, Dart} from "dart-polisher";

/*
	Dart2js Exceptions are wrapped in javascript Error objects.
	An aditional dartException property is defined in the Error object.
	This is defined in dart-polisher typings in the Dart namespace as 'interface Exception'.

	So an thrown object from Dart looks like this: (extends from Error)
	interface Exception {
		name: string, 		// inherited from Error
		message: string, 	// inherited from Error
		stack?: string, 	// inherited from Error
		dartException: any
	}

	'dartException: any' can be a DartPolisher FException wich looks like this:
	interface FException
	{
		code: string;
		message: string;
		originalException: any;
	}
*/

// Checks if error is a valid Dart Exception.
export function isDartException(error: unknown) : error is Dart.Exception {
	return (
		typeof error === "object" &&
		error !== null &&
		"dartException" in error &&
		typeof (error as Dart.Exception).dartException === "object"
	  );
}

export function isPolisherException(error: unknown) : error is FException {
	return (
		isDartException(error) &&
		error.dartException !== null &&
		"code" in error.dartException &&
		typeof (error.dartException as FException).code === "string"
	  );
}
